#!/bin/bash

# AWS Deployment Script for Bets.Fun
# This script automates the deployment process to AWS

set -e

echo "🚀 Starting AWS deployment for Bets.Fun..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if required environment variables are set
required_vars=("AWS_REGION" "DB_PASSWORD" "SESSION_SECRET" "ADMIN_SOLANA_PRIVATE_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Environment variable $var is not set"
        exit 1
    fi
done

# Set default values
AWS_REGION=${AWS_REGION:-us-east-1}
APP_NAME=${APP_NAME:-bets-fun}
ENVIRONMENT=${ENVIRONMENT:-production}

echo "📋 Configuration:"
echo "  Region: $AWS_REGION"
echo "  App Name: $APP_NAME"
echo "  Environment: $ENVIRONMENT"

# Function to create RDS instance
create_rds() {
    echo "🗄️ Creating RDS PostgreSQL instance..."
    
    aws rds create-db-instance \
        --db-instance-identifier ${APP_NAME}-db \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 15.4 \
        --master-username admin \
        --master-user-password $DB_PASSWORD \
        --allocated-storage 20 \
        --storage-type gp2 \
        --backup-retention-period 7 \
        --region $AWS_REGION \
        --no-multi-az \
        --publicly-accessible \
        --storage-encrypted
    
    echo "⏳ Waiting for RDS instance to be available..."
    aws rds wait db-instance-available \
        --db-instance-identifier ${APP_NAME}-db \
        --region $AWS_REGION
    
    # Get RDS endpoint
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier ${APP_NAME}-db \
        --region $AWS_REGION \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    echo "✅ RDS instance created: $RDS_ENDPOINT"
    export DATABASE_URL="postgresql://admin:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/postgres"
}

# Function to store secrets in AWS Systems Manager
store_secrets() {
    echo "🔐 Storing secrets in AWS Systems Manager..."
    
    aws ssm put-parameter \
        --name "/${APP_NAME}/database-url" \
        --value "$DATABASE_URL" \
        --type "SecureString" \
        --region $AWS_REGION \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "/${APP_NAME}/session-secret" \
        --value "$SESSION_SECRET" \
        --type "SecureString" \
        --region $AWS_REGION \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "/${APP_NAME}/admin-solana-key" \
        --value "$ADMIN_SOLANA_PRIVATE_KEY" \
        --type "SecureString" \
        --region $AWS_REGION \
        --overwrite || true
}

# Function to create ECR repository
create_ecr() {
    echo "📦 Creating ECR repository..."
    
    aws ecr create-repository \
        --repository-name $APP_NAME \
        --region $AWS_REGION \
        --image-scanning-configuration scanOnPush=true || true
    
    # Get ECR URI
    ECR_URI=$(aws ecr describe-repositories \
        --repository-names $APP_NAME \
        --region $AWS_REGION \
        --query 'repositories[0].repositoryUri' \
        --output text)
    
    echo "✅ ECR repository created: $ECR_URI"
}

# Function to build and push Docker image
build_and_push() {
    echo "🏗️ Building and pushing Docker image..."
    
    # Get ECR login token
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin $ECR_URI
    
    # Build image
    docker build -t $APP_NAME .
    docker tag $APP_NAME:latest $ECR_URI:latest
    
    # Push image
    docker push $ECR_URI:latest
    
    echo "✅ Docker image pushed to ECR"
}

# Function to create ECS cluster
create_ecs_cluster() {
    echo "🏗️ Creating ECS cluster..."
    
    aws ecs create-cluster \
        --cluster-name ${APP_NAME}-cluster \
        --capacity-providers FARGATE \
        --region $AWS_REGION || true
}

# Function to create ECS task definition
create_task_definition() {
    echo "📝 Creating ECS task definition..."
    
    cat > task-definition.json << EOF
{
    "family": "${APP_NAME}-task",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "${APP_NAME}",
            "image": "${ECR_URI}:latest",
            "portMappings": [
                {
                    "containerPort": 5000,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {
                    "name": "NODE_ENV",
                    "value": "production"
                }
            ],
            "secrets": [
                {
                    "name": "DATABASE_URL",
                    "valueFrom": "arn:aws:ssm:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):parameter/${APP_NAME}/database-url"
                },
                {
                    "name": "SESSION_SECRET",
                    "valueFrom": "arn:aws:ssm:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):parameter/${APP_NAME}/session-secret"
                },
                {
                    "name": "ADMIN_SOLANA_PRIVATE_KEY",
                    "valueFrom": "arn:aws:ssm:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):parameter/${APP_NAME}/admin-solana-key"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/${APP_NAME}",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
EOF
    
    aws ecs register-task-definition \
        --cli-input-json file://task-definition.json \
        --region $AWS_REGION
    
    echo "✅ Task definition created"
}

# Function to create ECS service
create_ecs_service() {
    echo "🚀 Creating ECS service..."
    
    # Get default VPC and subnets
    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=isDefault,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text \
        --region $AWS_REGION)
    
    SUBNET_IDS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[0:2].SubnetId' \
        --output text \
        --region $AWS_REGION | tr '\t' ',')
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group \
        --group-name ${APP_NAME}-sg \
        --description "Security group for ${APP_NAME}" \
        --vpc-id $VPC_ID \
        --region $AWS_REGION \
        --query 'GroupId' \
        --output text 2>/dev/null || \
        aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=${APP_NAME}-sg" \
        --query 'SecurityGroups[0].GroupId' \
        --output text \
        --region $AWS_REGION)
    
    # Allow HTTP traffic
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 5000 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION 2>/dev/null || true
    
    aws ecs create-service \
        --cluster ${APP_NAME}-cluster \
        --service-name ${APP_NAME}-service \
        --task-definition ${APP_NAME}-task \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --region $AWS_REGION
    
    echo "✅ ECS service created"
}

# Main execution
case "${1:-all}" in
    "rds")
        create_rds
        ;;
    "secrets")
        store_secrets
        ;;
    "ecr")
        create_ecr
        ;;
    "build")
        build_and_push
        ;;
    "ecs")
        create_ecs_cluster
        create_task_definition
        create_ecs_service
        ;;
    "all")
        create_rds
        store_secrets
        create_ecr
        build_and_push
        create_ecs_cluster
        create_task_definition
        create_ecs_service
        ;;
    *)
        echo "Usage: $0 [rds|secrets|ecr|build|ecs|all]"
        exit 1
        ;;
esac

echo "🎉 Deployment completed successfully!"
echo "📋 Next steps:"
echo "  1. Wait for ECS service to be running"
echo "  2. Get the public IP from ECS tasks"
echo "  3. Set up domain and SSL certificate"
echo "  4. Configure application load balancer"