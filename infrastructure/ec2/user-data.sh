#!/bin/bash
# EC2 User Data – bootstraps a fresh Amazon Linux 2023 instance for time2meet.
#
# Run order: this script executes once at first boot via cloud-init.
# After provisioning, GitHub Actions deploys new images via SSH + docker compose.
#
# Prerequisites (set before launching the instance):
#   - IAM instance profile with ec2-instance-policy.json attached
#   - The following SSM parameters under /time2meet/:
#       /time2meet/ecr-registry          e.g. 123456789012.dkr.ecr.us-west-2.amazonaws.com
#       /time2meet/aws-region            e.g. us-west-2
#       /time2meet/cognito-user-pool-id
#       /time2meet/cognito-client-id
#       /time2meet/mysql-host            RDS endpoint
#       /time2meet/mysql-user
#       /time2meet/mysql-password
#       /time2meet/mysql-database
#       /time2meet/public-url            ALB DNS or custom domain
#       /time2meet/smtp-host
#       /time2meet/smtp-port
#       /time2meet/smtp-from
#       /time2meet/smtp-user
#       /time2meet/smtp-password
set -euo pipefail

# ── Helper: fetch an SSM parameter ──────────────────────────────────────────
ssm() {
  aws ssm get-parameter --name "$1" --with-decryption \
    --query 'Parameter.Value' --output text --region "$(ec2-metadata --region | cut -d' ' -f2)"
}

REGION=$(ec2-metadata --region | cut -d' ' -f2)

# ── 1. System packages ───────────────────────────────────────────────────────
dnf update -y
dnf install -y docker amazon-cloudwatch-agent jq awscli

# ── 2. Docker ────────────────────────────────────────────────────────────────
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# docker compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL \
  "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# ── 3. App directory ─────────────────────────────────────────────────────────
mkdir -p /opt/time2meet
chown ec2-user:ec2-user /opt/time2meet

# ── 4. Read secrets from SSM and write env files ─────────────────────────────
# These env files are consumed by docker-compose.prod.yml.
# Secrets are never stored in the repository.

ECR_REGISTRY=$(ssm /time2meet/ecr-registry)

cat > /opt/time2meet/.env.common << EOF
NODE_ENV=production
DATABASE_TYPE=mariadb
MYSQL_HOST=$(ssm /time2meet/mysql-host)
MYSQL_PORT=3306
MYSQL_USER=$(ssm /time2meet/mysql-user)
MYSQL_PASSWORD=$(ssm /time2meet/mysql-password)
MYSQL_DATABASE=$(ssm /time2meet/mysql-database)
PUBLIC_URL=$(ssm /time2meet/public-url)
ENABLE_CORS=true
TRUST_PROXY=true
VERIFY_SIGNUP_EMAIL_ADDRESS=true
COGNITO_REGION=${REGION}
COGNITO_USER_POOL_ID=$(ssm /time2meet/cognito-user-pool-id)
COGNITO_CLIENT_ID=$(ssm /time2meet/cognito-client-id)
SMTP_HOST=$(ssm /time2meet/smtp-host)
SMTP_PORT=$(ssm /time2meet/smtp-port)
SMTP_FROM=$(ssm /time2meet/smtp-from)
SMTP_USER=$(ssm /time2meet/smtp-user)
SMTP_PASSWORD=$(ssm /time2meet/smtp-password)
ECR_REGISTRY=${ECR_REGISTRY}
AWS_REGION=${REGION}
EOF
chmod 600 /opt/time2meet/.env.common
chown ec2-user:ec2-user /opt/time2meet/.env.common

# ── 5. Copy docker-compose.prod.yml from S3 or embed inline ─────────────────
# The deploy workflow uploads docker-compose.prod.yml to the instance via SSH.
# On first boot we just pull it from the repo via GitHub or S3 if configured.
# For simplicity, the file is already included in infrastructure/ec2/ in the repo.

# ── 6. CloudWatch Agent config ───────────────────────────────────────────────
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWEOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/time2meet/system",
            "log_stream_name": "{instance_id}/messages",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "time2meet/EC2",
    "metrics_collected": {
      "cpu":    { "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"], "metrics_collection_interval": 60 },
      "disk":   { "measurement": ["used_percent"], "metrics_collection_interval": 60, "resources": ["*"] },
      "mem":    { "measurement": ["mem_used_percent"], "metrics_collection_interval": 60 },
      "netstat":{ "measurement": ["tcp_established", "tcp_time_wait"], "metrics_collection_interval": 60 }
    },
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}",
      "InstanceType": "${aws:InstanceType}"
    }
  }
}
CWEOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# ── 7. Login to ECR and start services ──────────────────────────────────────
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# docker-compose.prod.yml must already be present in /opt/time2meet/
# (placed there by the deploy workflow or copied from the repo).
if [ -f /opt/time2meet/docker-compose.prod.yml ]; then
  cd /opt/time2meet
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d
fi

# ── 8. systemd unit – auto-start containers on reboot ───────────────────────
cat > /etc/systemd/system/time2meet.service << 'UNITEOF'
[Unit]
Description=time2meet microservices
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/time2meet
EnvironmentFile=/opt/time2meet/.env.common
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml down
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable time2meet.service
