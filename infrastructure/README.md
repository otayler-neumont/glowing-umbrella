# RPG Platform Backend Infrastructure

This directory contains the AWS CDK infrastructure code for the Tabletop RPG Campaign Management Platform.

## 🏗️ Architecture Overview

- **NetworkStack**: VPC, security groups, and interface endpoints
- **DatabaseStack**: RDS PostgreSQL with Secrets Manager
- **AuthStack**: Cognito User Pool and App Client
- **MessagingStack**: SQS queue with DLQ and SNS topic for invitations
- **ApiStack**: API Gateway with Lambda functions and JWT authorization
- **MonitoringStack**: CloudWatch dashboards, alarms, and AWS Budgets

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 18+** and npm
3. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
4. **CDK bootstrapped** in your AWS account: `cdk bootstrap`

### Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Deploy all stacks:**
   ```bash
   ./deploy.sh
   ```
   
   Or manually:
   ```bash
   npx cdk deploy NetworkStack DatabaseStack AuthStack MessagingStack ApiStack MonitoringStack --require-approval never
   ```

### Environment Outputs and Consumption

- SSM Parameters written:
  - `/rpg/auth/userPoolId`, `/rpg/auth/userPoolArn`, `/rpg/auth/userPoolClientId`
  - `/rpg/db/secretArn`, `/rpg/db/endpoint`
  - `/rpg/mq/inviteQueueUrl`, `/rpg/mq/inviteQueueArn`
- API Gateway URL output: `ApiStack.ApiGatewayUrl`
- Configure the web app `.env.local` using these values.

### Post-Deployment Setup

1. **Run Database Migration:**
   ```bash
   # Get the migration function name from CDK outputs
   MIGRATE_FN=$(npx cdk list-exports | grep "DatabaseStack.MigrateFunctionName" | awk '{print $3}')
   
   # Invoke the migration
   aws lambda invoke --function-name $MIGRATE_FN --payload '{}' response.json
   ```

2. **Subscribe to SNS Topic:**
   - Go to SNS console
   - Find topic ARN in SSM parameter: `/rpg/mq/inviteTopicArn`
   - Subscribe your email address for testing

3. **Test API Endpoints:**
   - Import Postman collection: `test/postman/rpg-api.postman_collection.json`
   - Update variables with your Cognito tokens
   - Test all endpoints

## 🔧 API Endpoints

### Base URL
```
https://wriwn89rvj.execute-api.us-east-1.amazonaws.com/prod
```

### Available Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/ping` | Health check | No |
| POST | `/v1/campaigns` | Create campaign | Yes (JWT) |
| GET | `/v1/campaigns` | List my campaigns | Yes (JWT) |
| GET | `/v1/campaigns/{id}` | Get campaign details | Yes (JWT) |
| POST | `/v1/campaigns/{id}/invites` | Send invitation | Yes (JWT) |
| POST | `/v1/invites/{token}/accept` | Accept invitation | Yes (JWT) |
| POST | `/v1/campaigns/{id}/sessions` | Create session | Yes (JWT, GM only) |
| GET | `/v1/campaigns/{id}/sessions` | List sessions | Yes (JWT) |
| GET | `/v1/characters/me` | Get my character | Yes (JWT) |
| PUT | `/v1/characters/me` | Create/update character | Yes (JWT) |

Admin:

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/admin/users` | List Cognito users | Yes (JWT, `admin` group) |
| DELETE | `/v1/admin/users/{username}` | Delete Cognito user | Yes (JWT, `admin` group) |

## 🧪 Testing

### Postman Collection
Import the collection from `test/postman/rpg-api.postman_collection.json` and update the variables:

- `API_BASE`: Your API Gateway URL
- `ID_TOKEN`: Cognito ID token from the web app
- `CAMPAIGN_ID`: Campaign UUID (create one first)
- `INVITE_TOKEN`: Invitation token (sent via email)

### Test Flow
1. **Create Campaign** → Get campaign ID
2. **Send Invite** → Check email for invitation
3. **Accept Invite** → Join campaign as player
4. **Create Session** → Schedule game session
5. **Create Character** → Set up player character

## 🔍 Troubleshooting

### Common Issues

1. **502/500 API Errors:**
   - Database tables not created yet - run migration
   - Check CloudWatch logs for Lambda functions

2. **Authentication Errors:**
   - Ensure Cognito tokens are valid
   - Check JWT expiration

3. **Database Connection Issues:**
   - Verify RDS security group allows Lambda access
   - Check Secrets Manager permissions

4. **SQS/SNS Issues:**
   - Verify Lambda has SQS read permissions
   - Check SNS topic subscription

### Logs and Monitoring

- **API Gateway**: CloudWatch access logs
- **Lambda Functions**: CloudWatch log groups
- **RDS**: CloudWatch metrics and logs
- **SQS**: CloudWatch metrics

## 📁 Project Structure

```
infrastructure/
├── lib/                    # CDK stack definitions
│   ├── api-stack.ts       # API Gateway + Lambda functions
│   ├── auth-stack.ts      # Cognito configuration
│   ├── database-stack.ts  # RDS + Secrets Manager
│   ├── messaging-stack.ts # SQS + SNS
│   ├── monitoring-stack.ts # CloudWatch + Alarms
│   └── network-stack.ts   # VPC + Security Groups
├── lambda-src/            # Lambda function source code
│   ├── api.ts            # Main API handlers
│   ├── migrate.ts        # Database migration
│   └── sqs-consumer.ts   # SQS message processor
├── sql/                   # Database schema and migrations
├── test/                  # Test files
└── deploy.sh             # Deployment script
```

## 🔐 Security Features

- **JWT Authorization**: Cognito-based token validation
- **Request Validation**: JSON schema validation for all POST/PUT endpoints
- **VPC Isolation**: Lambda functions in private subnets
- **Secrets Management**: Database credentials in Secrets Manager
- **Least Privilege**: IAM roles scoped to specific resources
- **CORS Configuration**: Configurable origin allow-list
 - **Interface VPC Endpoints**: NAT-less access to SSM, KMS, SQS, SNS, CloudWatch Logs, Secrets Manager

## 📊 Monitoring and Alerts

- **API Gateway**: 5xx errors, latency, request count
- **Lambda**: Error rates, duration, throttles
- **RDS**: CPU utilization, connections, storage
- **Cost Control**: Monthly budget alerts

## 🚀 Next Steps

After successful deployment:

1. **Test all endpoints** with Postman
2. **Verify SNS email delivery** for invitations
3. **Start the web application** (`cd ../web && npm run dev`)
4. **Create test campaigns** and invite players
5. **Monitor CloudWatch** for any issues

## 📞 Support

For issues or questions:
1. Check CloudWatch logs first
2. Verify all environment variables are set
3. Ensure proper IAM permissions
4. Check the project status document for known issues
