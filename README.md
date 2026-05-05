## Description
time2meet is an AWS cloud-based version of Cabbage Meet
(https://github.com/maxerenberg/cabbagemeet), a meeting scheduler calendar web 
application. Refactored for microservice architecture and supported by AWS
infrastructure, time2meet expands upon Cabbage Meet by replacing email-based
authentication with AWS Cognito and introduced generative AI summaries through
AWS Bedrock.

Meeting respondents can submit their availabilities by clicking or dragging
their available times on a grid, making it easier to see the times at which
most people are available. Respondents can get notified via email when
a meeting is scheduled.

Google/Outlook calendar integration is also supported, so an event can be
created on your personal calendar when a meeting is scheduled.

Production domain: https://master.d2fubs3yfigftd.amplifyapp.com/

## Architecture
### Code
Source code is split into three microservices: auth, users, and meetings.
AWS Cognito and Bedrock were implemented using GitHub Actions CI/CD pipelines.
Each microservice is containerized and deployed using Docker.

### Frontend
AWS Amplify hosts the client-side code while also enabling CI/CD workflows.

### Backend Servers
AWS EC2 instances in an Auto Scaling Group are connected to AWS CloudFront
with a Load Balancer in place. This allows for HTTPS requests using CloudFront's
default certificate. The Docker containers are kept in ECR private repositories
and pulled for each EC2 instance.

### Database
An AWS RDS MariaDB instance is used as the master database. Data at rest is encrypted
with AWS KMS, credentials are stored and also encrypted by AWS KMS in AWS SSM.
