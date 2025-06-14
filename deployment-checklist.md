# AWS Deployment Checklist

## Pre-Deployment Requirements

### AWS Account Setup
- [ ] AWS account with appropriate permissions
- [ ] AWS CLI installed and configured
- [ ] Docker installed for containerization
- [ ] Domain name registered (optional)

### Environment Variables Preparation
- [ ] PostgreSQL database password
- [ ] Session secret key (32+ character random string)
- [ ] Admin Solana private key array format
- [ ] Authentication provider credentials

## Step-by-Step Deployment

### 1. Initial Setup
```bash
# Clone and prepare project
git clone <your-repo>
cd bets-fun
cp .env.example .env
# Edit .env with your configuration
```

### 2. Database Setup
```bash
# Set required environment variables
export AWS_REGION=us-east-1
export DB_PASSWORD=your-secure-db-password
export APP_NAME=bets-fun

# Create RDS instance
./aws-deploy.sh rds
```

### 3. Authentication Configuration
Choose and implement one authentication method:
- [ ] AWS Cognito (recommended)
- [ ] Auth0
- [ ] Firebase Auth
- [ ] Custom OAuth

### 4. Application Deployment
```bash
# Set additional environment variables
export SESSION_SECRET=your-session-secret
export ADMIN_SOLANA_PRIVATE_KEY=[1,2,3,...]

# Deploy application
./aws-deploy.sh all
```

### 5. DNS and SSL Setup
```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS

# Set up Route 53 hosted zone
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)
```

### 6. Load Balancer Configuration
```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name bets-fun-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345
```

## Post-Deployment Verification

### Health Checks
- [ ] Application responds at health endpoint
- [ ] Database connection successful
- [ ] Authentication flow working
- [ ] Blockchain transactions functional

### Security Verification
- [ ] SSL certificate active
- [ ] Security groups properly configured
- [ ] Environment variables secure
- [ ] No sensitive data in logs

### Performance Testing
- [ ] Load testing completed
- [ ] Database queries optimized
- [ ] CDN configured (if needed)
- [ ] Monitoring alerts set up

## Monitoring Setup

### CloudWatch Configuration
```bash
# Create log group
aws logs create-log-group \
  --log-group-name /ecs/bets-fun

# Set up metric filters
aws logs put-metric-filter \
  --log-group-name /ecs/bets-fun \
  --filter-name ErrorFilter \
  --filter-pattern "ERROR" \
  --metric-transformations \
    metricName=ApplicationErrors,metricNamespace=BetsFun,metricValue=1
```

### Alarms
- [ ] Database connection errors
- [ ] High CPU utilization
- [ ] Memory usage alerts
- [ ] Failed authentication attempts

## Backup Strategy

### Database Backups
- [ ] Automated RDS backups enabled
- [ ] Cross-region backup replication
- [ ] Point-in-time recovery tested

### Application Backups
- [ ] Container images stored in ECR
- [ ] Configuration backed up
- [ ] Deployment scripts versioned

## Scaling Configuration

### Auto Scaling
```bash
# Create auto scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/bets-fun-cluster/bets-fun-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10
```

### Database Scaling
- [ ] Read replicas for read-heavy workloads
- [ ] Connection pooling configured
- [ ] Query optimization completed

## Security Hardening

### Network Security
- [ ] VPC properly configured
- [ ] Private subnets for database
- [ ] NAT Gateway for outbound traffic
- [ ] VPC Flow Logs enabled

### Application Security
- [ ] WAF rules configured
- [ ] Rate limiting implemented
- [ ] Input validation active
- [ ] Security headers configured

## Cost Optimization

### Resource Optimization
- [ ] Right-sized EC2 instances
- [ ] Reserved instances purchased
- [ ] Unused resources removed
- [ ] Cost alerts configured

### Development Environment
- [ ] Scheduled scaling for dev environment
- [ ] Smaller instance types for testing
- [ ] Automated resource cleanup

## Troubleshooting Guide

### Common Issues
1. **Database Connection Errors**
   - Check security group rules
   - Verify connection string
   - Confirm database availability

2. **Authentication Failures**
   - Verify provider configuration
   - Check callback URLs
   - Validate environment variables

3. **Container Startup Issues**
   - Review CloudWatch logs
   - Check resource limits
   - Verify environment variables

4. **High Latency**
   - Monitor database queries
   - Check network configuration
   - Review application logs

### Support Resources
- AWS Support Center
- CloudWatch Logs
- X-Ray tracing (if enabled)
- Application metrics dashboard