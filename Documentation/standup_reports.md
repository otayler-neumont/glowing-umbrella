Standup 8:
Standup:
Parker created a CDK app skeleton and split it into Network, Auth, and Database stacks
Oscar configured a Cognito User Pool + App Client and wired a JWT authorizer in API Gateway
Ramon bootstrapped frontend auth with Amplify and basic login/register pages in SvelteKit
Ollie tweeted
Roadblocks: minor IAM permission errors on the authorizer; fixed
What will be done tomorrow: finish VPC with private subnets, add interface endpoints (SQS, SNS, SSM), create RDS and baseline migrations in repo

Standup 9:
Standup:
Parker provisioned a VPC with two private subnets and security groups; created RDS PostgreSQL in private subnets
Oscar stored DB credentials in SSM (KMS-encrypted) and added migration tooling with a baseline schema
Ramon validated auth flow end-to-end and added protected route guards
Roadblocks: CORS allow-list not applied to authorizer; corrected stage settings
What will be done tomorrow: add API Gateway stage logging/throttling, implement POST /v1/campaigns and GET /v1/campaigns with validators

Standup 10:
Standup:
Parker enabled API Gateway access logs and throttling; added the JWT authorizer to routes
Oscar implemented request models/validators and a consistent error shape
Ramon built the create campaign UI and hooked it to the API with JWT
Roadblocks: SQL connection string issue from Lambda in VPC; security group fixed
What will be done tomorrow: implement GET /v1/campaigns/{id}, session endpoints, and character endpoints

Standup 11:
Standup:
Parker implemented GET /v1/campaigns/{id} and session routes in Lambdas; connected to RDS using a pooled client
Oscar added character endpoints and wrote Postman tests
Ramon added sessions list/create UI and a basic character page
Roadblocks: None
What will be done tomorrow: wire invitations using an SQS producer and an SNS email consumer

Standup 12:
Standup:
Parker created an SQS queue with a DLQ and idempotency key strategy; implemented the invite producer in the API
Oscar built an SQS-triggered Lambda consumer that publishes emails to an SNS topic and verified the subscription
Ramon created invite UI and acceptance screen; acceptance joins the user to the campaign
Ollie tweeted loudly
Roadblocks: email deliverability quirks; using SNS email subscription for demo
What will be done tomorrow: add CloudWatch dashboards/alarms and AWS Budgets; improve structured logging

Standup 13:
Standup:
Parker added CloudWatch dashboards for API Gateway, Lambda, and RDS; created alarms
Oscar tightened IAM to least privilege; moved secrets to SSM SecureString with KMS; added correlation IDs to logs
Ramon cleaned up CORS and accessibility on forms
Roadblocks: missing SQS permissions on the consumer role; fixed
What will be done tomorrow: split CDK stacks cleanly and set up a GitHub Actions OIDC deploy pipeline

Standup 14:
Standup:
Parker organized CDK stacks: NetworkStack, DatabaseStack, AuthStack, MessagingStack, ApiStack, MonitoringStack
Oscar set up GitHub Actions with OIDC to assume a deploy role; added jobs for lint/test/build/deploy to dev
Ramon wired environment configs and finished core UI flows
Bun Bun bunned
Roadblocks: OIDC trust policy issue; resolved
What will be done tomorrow: write unit tests, finalize docs, diagrams, and demo script

Standup 15:
Standup:
Parker wrote unit tests for create campaign, invite enqueue, accept invite, and create session; CI green
Oscar produced the README quickstart, architecture diagram, ERD, Postman collection, and a runbook
Ramon polished the UI, added validation, and rehearsed the 5–7 minute demo path
Bunbina napped
Roadblocks: None
What will be done tomorrow: final acceptance checklist review and presentation

Standup 16:
Standup:
Team completed the final acceptance checklist and delivered the demo end-to-end
Roadblocks: None
What will be done tomorrow: rest


