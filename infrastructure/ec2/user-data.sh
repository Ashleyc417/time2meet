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
#       /time2meet/cognito-region        e.g. us-west-2  (may differ from the EC2 region)
#       /time2meet/cognito-user-pool-id
#       /time2meet/cognito-client-id
#       /time2meet/mysql-host            RDS endpoint
#       /time2meet/mysql-user
#       /time2meet/mysql-password
#       /time2meet/mysql-database
#       /time2meet/public-url            ALB DNS or domain – http:// is prepended if absent
#   Optional (SMTP disabled if absent):
#       /time2meet/smtp-host
#       /time2meet/smtp-port
#       /time2meet/smtp-from
#       /time2meet/smtp-user
#       /time2meet/smtp-password
#   Optional (CORS – the Amplify frontend URL):
#       /time2meet/amplify-url          e.g. https://main.xxxx.amplifyapp.com
set -euo pipefail

# ── Helpers: fetch SSM parameters ───────────────────────────────────────────
# ssm: required – script aborts (set -e) if the parameter is missing
ssm() {
  aws ssm get-parameter --name "$1" --with-decryption \
    --query 'Parameter.Value' --output text --region "$(ec2-metadata --region | cut -d' ' -f2)"
}

# ssm_opt: optional – returns empty string if the parameter does not exist
ssm_opt() {
  aws ssm get-parameter --name "$1" --with-decryption \
    --query 'Parameter.Value' --output text \
    --region "$(ec2-metadata --region | cut -d' ' -f2)" 2>/dev/null || echo ""
}

REGION=$(ec2-metadata --region | cut -d' ' -f2)

# ── 1. System packages ───────────────────────────────────────────────────────
dnf update -y
dnf install -y docker amazon-cloudwatch-agent jq awscli

# ── 2. Docker ────────────────────────────────────────────────────────────────
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Docker Compose v2 plugin – not in AL2023 repos; install binary from GitHub releases
COMPOSE_VERSION="v2.24.6"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# ── 3. App directory ─────────────────────────────────────────────────────────
mkdir -p /opt/time2meet
chown ec2-user:ec2-user /opt/time2meet

# ── 4. Read secrets from SSM and write env files ─────────────────────────────
# These env files are consumed by docker-compose.prod.yml.
# Secrets are never stored in the repository.

ECR_REGISTRY=$(ssm /time2meet/ecr-registry)

# Ensure PUBLIC_URL always has an http:// scheme so the env validator accepts it
_PUBLIC_URL_RAW=$(ssm /time2meet/public-url)
case "${_PUBLIC_URL_RAW}" in
  http://*|https://*) PUBLIC_URL="${_PUBLIC_URL_RAW}" ;;
  *) PUBLIC_URL="http://${_PUBLIC_URL_RAW}" ;;
esac

cat > /opt/time2meet/.env << EOF
NODE_ENV=production
DATABASE_TYPE=mariadb
MYSQL_HOST=$(ssm /time2meet/mysql-host)
MYSQL_PORT=3306
MYSQL_USER=$(ssm /time2meet/mysql-user)
MYSQL_PASSWORD=$(ssm /time2meet/mysql-password)
MYSQL_DATABASE=$(ssm /time2meet/mysql-database)
PUBLIC_URL=${PUBLIC_URL}
ENABLE_CORS=true
EXTRA_CORS_ORIGINS=${EXTRA_CORS_ORIGINS}
TRUST_PROXY=true
VERIFY_SIGNUP_EMAIL_ADDRESS=false
COGNITO_REGION=$(ssm /time2meet/cognito-region)
COGNITO_USER_POOL_ID=$(ssm /time2meet/cognito-user-pool-id)
COGNITO_CLIENT_ID=$(ssm /time2meet/cognito-client-id)
SMTP_HOST=$(ssm_opt /time2meet/smtp-host)
SMTP_PORT=$(ssm_opt /time2meet/smtp-port)
SMTP_FROM=$(ssm_opt /time2meet/smtp-from)
SMTP_USER=$(ssm_opt /time2meet/smtp-user)
SMTP_PASSWORD=$(ssm_opt /time2meet/smtp-password)
EXTRA_CORS_ORIGINS=$(ssm_opt /time2meet/amplify-url)
ECR_REGISTRY=${ECR_REGISTRY}
AWS_REGION=${REGION}
EOF
chmod 600 /opt/time2meet/.env
chown ec2-user:ec2-user /opt/time2meet/.env

# ── 5. Clone repo and copy docker-compose.prod.yml ───────────────────────────
dnf install -y git
git clone --branch master --single-branch https://github.com/Ashleyc417/time2meet.git /tmp/time2meet-repo
cp /tmp/time2meet-repo/infrastructure/ec2/docker-compose.prod.yml /opt/time2meet/docker-compose.prod.yml
chown ec2-user:ec2-user /opt/time2meet/docker-compose.prod.yml
rm -rf /tmp/time2meet-repo

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
EnvironmentFile=/opt/time2meet/.env
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml down
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable time2meet.service
