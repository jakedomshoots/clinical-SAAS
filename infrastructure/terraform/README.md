# Concierge OS Production Infrastructure

Terraform configuration for deploying Concierge OS on AWS with HIPAA-eligible services.

## Prerequisites

- Terraform >= 1.7.0
- AWS CLI configured with appropriate credentials
- Domain name and DNS access (for ACM certificate validation)

## Quick Start

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -var="environment=production" -var="domain_name=your-domain.com"

# Apply the deployment
terraform apply -var="environment=production" -var="domain_name=your-domain.com"
```

## Architecture

- **VPC**: 3 AZs with public/private subnets, NAT gateways, flow logs
- **Database**: RDS PostgreSQL 16 with Multi-AZ, encryption, backups
- **Cache**: ElastiCache Redis 7 with encryption and failover
- **Compute**: ECS Fargate with auto-scaling
- **Storage**: S3 with KMS encryption, versioning, lifecycle policies
- **Networking**: Application Load Balancer with TLS 1.3
- **Monitoring**: CloudWatch alarms, dashboards, SNS alerts
- **Security**: KMS encryption, Secrets Manager, security groups

## Security Features

- All data encrypted at rest (KMS) and in transit (TLS)
- Private subnets for database and cache
- Security groups with least-privilege access
- Secrets managed via AWS Secrets Manager
- CloudTrail logging enabled
- VPC flow logs enabled

## HIPAA Considerations

- All services are HIPAA-eligible AWS services
- BAA required from AWS (separate process)
- Backup retention: 30 days for DB, 7 years for logs
- Access logging enabled on all storage
- Encryption keys with automatic rotation
