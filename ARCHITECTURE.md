Architecture Overview
======================

High-level view of the Tabletop RPG Platform: a Next.js web app backed by an AWS CDK-deployed serverless backend with Cognito authentication, API Gateway + Lambda, PostgreSQL on RDS, and SQS-driven email invites via SES.

## Components

- Web (Next.js 15, `web/`)
  - Amplify Auth (Cognito) for sign-up, confirmation, and sign-in
  - App Router pages: `/`, `/auth`, `/dashboard`, `/accept`
  - Proxy route `GET/POST /api/proxy/...` forwards to API Gateway and preserves `Authorization`/`Content-Type`
  - Dashboard client sections call the proxy with `Authorization: Bearer <Cognito idToken>`

- Backend (AWS, `infrastructure/`)
  - NetworkStack: VPC with isolated subnets, SGs, VPC Interface Endpoints (SSM, KMS, SQS, SNS, CW Logs, Secrets Manager)
  - DatabaseStack: RDS Postgres 16, Secrets Manager credentials, `MigrateFn` Lambda to run SQL schema and seed
  - AuthStack: Cognito User Pool + App Client, default groups (`admin`, `player`), post-confirm trigger adds users to `player`
  - MessagingStack: SQS invite queue and DLQ; Lambda consumer sends invite emails via SES
  - ApiStack: REST API (`/v1`) with Lambda handlers for campaigns, invites, sessions, characters, and admin endpoints
  - MonitoringStack: CloudWatch alarms and dashboard; optional monthly budget

## Data Flow

1. Auth
   - User signs up and confirms via Cognito (Amplify in web app).
   - On confirmation, a Lambda trigger adds the user to the `player` group.
   - Sign-in yields a Cognito ID token stored by Amplify; frontend includes it in `Authorization: Bearer <idToken>` when calling the proxy.

2. API Requests
   - Web calls `GET/POST /api/proxy/...` → forwards to `${NEXT_PUBLIC_API_BASE}/...`.
   - API Gateway validates Cognito JWT for protected routes.
   - Lambda handlers (Node.js) connect to RDS using Secrets Manager credentials over VPC.

3. Campaigns & Sessions
   - Users (identified by `cognito_user_id`) create campaigns.
   - Members (GM or players) list campaigns and sessions; GM creates sessions.

4. Invitations
   - GM posts to `/v1/campaigns/{id}/invites` → Lambda writes DB invite and enqueues SQS message.
   - SQS consumer sends SES email with acceptance link to `/v1/invites/{token}/accept`.
   - Accepting validates token, creates/links user, joins campaign, and marks invitation accepted.

## Security

- Cognito JWT authorizer on API Gateway; admin routes require `admin` group.
- RDS in isolated subnets; access restricted via SGs.
- Secrets in AWS Secrets Manager; Lambdas granted least-privilege access.
- Request models and validators on API for input schemas.
- VPC Interface Endpoints enable NAT-less access for AWS services.

## Environments & Configuration

- SSM Parameters:
  - `/rpg/auth/userPoolId`, `/rpg/auth/userPoolArn`, `/rpg/auth/userPoolClientId`
  - `/rpg/db/secretArn`, `/rpg/db/endpoint`
  - `/rpg/mq/inviteQueueUrl`, `/rpg/mq/inviteQueueArn`
- Web `.env.local` requires:
  - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_REGION`, `NEXT_PUBLIC_API_BASE`

## Local Dev to Prod Flow

1. Deploy infra: `cd infrastructure && npm i && npm run build && ./deploy.sh` (or `cdk deploy ...`).
2. Run migration Lambda once (stack output `MigrateFunctionName`).
3. Configure `.env.local` in `web/` with SSM/outputs.
4. Start web: `npm run dev` at `web/`.
5. Sign in at `/auth`, use `/dashboard` to create a campaign and invite a player.

## Key Files

- `web/src/app/api/proxy/[...segments]/route.ts` — proxy to API Gateway
- `web/src/app/dashboard/sections/*.tsx` — client calls to backend via proxy
- `infrastructure/lib/*-stack.ts` — CDK stacks
- `infrastructure/lambda-src/api.ts` — Lambda handlers
- `infrastructure/lambda-src/migrate.ts` — DB schema and seed
- `infrastructure/lambda-src/sqs-consumer.ts` — SES invite emails


