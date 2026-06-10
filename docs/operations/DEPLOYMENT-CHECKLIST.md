# Concierge OS Deployment Checklist

## Pre-Launch Requirements

### 1. Cloud Infrastructure

- [ ] AWS account with BAA signed
- [ ] Domain name purchased and DNS configured
- [ ] SSL certificate (ACM or Let's Encrypt)
- [ ] Terraform applied (VPC, ECS, RDS, Redis, ALB, S3)

### 2. Vendor Accounts

- [ ] Intuit QuickBooks Payments — OAuth app created, Client ID + Secret
- [ ] LabCorp — API access requested
- [ ] Quest Diagnostics — API access requested
- [ ] Twilio — Account SID + Auth Token, phone number purchased
- [ ] SRFax — API credentials
- [ ] Availity — API credentials
- [ ] DoseSpot — API credentials, EPCS enrollment
- [ ] Auth0 — Application created, MFA configured
- [ ] Google Cloud — Calendar API enabled, service account
- [ ] Daily.co — API key for telehealth

### 3. Regulatory

- [ ] State PDMP registration
- [ ] MIPS registry selection (Mingle/Clinigence)
- [ ] Immunization registry connection (state-specific)
- [ ] HIPAA risk analysis completed
- [ ] Business Associate Agreements signed with all vendors

### 4. Data Migration

- [ ] DrChrono export requested and received
- [ ] Patient data validated
- [ ] Historical claims/billing data imported
- [ ] Staff accounts created in Auth0

### 5. Staff Training

- [ ] All staff completed training modules
- [ ] Role-based permissions configured
- [ ] EPCS identity proofing completed
- [ ] Break-glass procedure documented and tested

### 6. Go-Live

- [ ] Production environment health check passing
- [ ] Backup verification script run
- [ ] Security hardening script applied
- [ ] Monitoring and alerting active
- [ ] Rollback plan tested
- [ ] Clinic sign-off obtained

## Post-Launch (Week 1)

- [ ] Daily health checks
- [ ] Monitor claim submission success rate
- [ ] Verify payment processing
- [ ] Check lab result flow
- [ ] Confirm eRx transmission
- [ ] Review audit logs for anomalies

## Post-Launch (Month 1)

- [ ] First MIPS data quality review
- [ ] Patient portal adoption check
- [ ] Staff feedback collected
- [ ] Performance optimization based on usage
- [ ] Security scan and patch cycle
