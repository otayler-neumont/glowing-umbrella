# Project Status and Next Steps

This document captures what’s implemented, what’s deployed in AWS, and what remains to reach the MVP for the Tabletop RPG Platform.

---

## High-Level Architecture
- Web: Next.js 15 app with AWS Amplify Auth (Cognito), client-side calls proxied via `app/api/proxy/*`.
- API: Amazon API Gateway (REST) → AWS Lambda (Node/TypeScript) → Amazon RDS for PostgreSQL.
- Auth: Amazon Cognito User Pool + Client, email-link verification enabled.
- MQ: Amazon SQS (invites queue) with DLQ; Lambda consumer publishes to Amazon SNS (email topic).
- Networking: VPC with private isolated subnets; interface endpoints for SQS/SNS/SSM/KMS/Logs/Secrets.
- Observability: CloudWatch dashboards and alarms (API 5xx, Lambda errors, RDS CPU); AWS Budgets.
- IaC: AWS CDK (TypeScript) with stacks per concern.

---

## Deployed Stacks (Current)
- NetworkStack: VPC, security groups, interface endpoints.
- DatabaseStack: RDS PostgreSQL + Secrets Manager creds; SSM params:
  - `/rpg/db/endpoint` (hostname)
  - `/rpg/db/secretArn` (Secrets Manager ARN)
  - Migration Lambda output: `DatabaseStack.MigrateFunctionName`
- AuthStack: Cognito User Pool + Client + groups; SSM params:
  - `/rpg/auth/userPoolId`
  - `/rpg/auth/userPoolArn`
  - `/rpg/auth/userPoolClientId`
  - Verification mode: email LINK (no code entry).
- MessagingStack: SQS + DLQ + SNS; SSM params:
  - `/rpg/mq/inviteQueueUrl`
  - `/rpg/mq/inviteQueueArn`
  - `/rpg/mq/inviteTopicArn`
- ApiStack: REST API with JWT authorizer, request validation, access logs.
  - Endpoint (prod stage): https://wriwn89rvj.execute-api.us-east-1.amazonaws.com/prod/
- MonitoringStack: CloudWatch dashboards/alarms and monthly budget.
- InfrastructureStack: convenience stack with optional migrate Lambda wiring (succeeds only if DB params exist).

---

## Backend: Implemented Endpoints
Base: `https://wriwn89rvj.execute-api.us-east-1.amazonaws.com/prod`

- Health
  - GET `/v1/ping`
- Campaigns (JWT required)
  - POST `/v1/campaigns` — create (sets `gm_id` from JWT)
  - GET `/v1/campaigns` — list only campaigns you own or joined
  - GET `/v1/campaigns/{id}` — requires ownership or membership
- Invitations (JWT required)
  - POST `/v1/campaigns/{id}/invites` — generate one-time token, store hash, enqueue SQS
  - POST `/v1/invites/{token}/accept` — validate token/expiry; idempotent join to `campaign_players`
- Sessions (JWT required)
  - POST `/v1/campaigns/{id}/sessions` — GM-only for that campaign
  - GET  `/v1/campaigns/{id}/sessions` — members only
- Characters (JWT required)
  - GET `/v1/characters/me?campaign_id=...` — member-only
  - PUT `/v1/characters/me` — upsert for current user in campaign

Notes
- DB schema includes: `users`, `campaigns`, `campaign_players`, `sessions`, `characters`, `invitations`.
- SQS producer uses least-privilege IAM (SendMessage scoped to invite queue ARN).

---

## Frontend: Current State
- Auth
  - Tabs: Sign in / Sign up.
  - Email link verification (no manual confirm)
  - On sign-in, redirects to `/dashboard`.
  - `Account` page shows session and sign-out.
- Dashboard
  - Card layout with: Health, Create Campaign, My Campaigns (with copy-ID), Invite Player, Sessions, Character.
- Proxy
  - `app/api/proxy/[...segments]/route.ts` forwards to API Gateway with `Authorization: Bearer <idToken>`.

Required environment variables (create `.env.local` in `web/`)
```
NEXT_PUBLIC_API_BASE=https://wriwn89rvj.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<read from SSM /rpg/auth/userPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<read from SSM /rpg/auth/userPoolClientId>
```

---

## Operational Steps
1) One-time CDK bootstrap (done)
2) Deploy stacks (done) — when needed:
```
cd infrastructure
npx cdk deploy NetworkStack DatabaseStack AuthStack MessagingStack ApiStack MonitoringStack --require-approval never
```
3) Run DB migrations (required once per new DB)
- Invoke Lambda shown in output `DatabaseStack.MigrateFunctionName` from AWS Console → Lambda → Test.
- Expected return: `migrated`.
4) Subscribe to invites SNS topic for test emails
- Topic ARN is in SSM `/rpg/mq/inviteTopicArn`. Subscribe your email in SNS console.
5) Local web dev
```
cd web
npm run dev
```

---

## What’s Completed
- VPC, RDS, Cognito, SQS/SNS, API Gateway, CloudWatch, Budgets via CDK.
- REST API with JWT authorizer and request validation/logging.
- Real invitation token flow with `invitations` table and acceptance endpoint.
- Authorization/data scoping for campaigns/sessions/characters.
- Least-privilege IAM for SQS SendMessage.
- Frontend UI pass: simplified Auth, `Account` page, dashboard cards, quick-start home.
- CI deploy workflow changed to manual (no auto-deploy on push to `main`).

---

## What’s Left (Next Steps)
- Database
  - [ ] Invoke migration Lambda on the new DB (creates tables + seed).
  - [ ] Add idempotent migration runner for future changes.
- Frontend UX
  - [ ] Add simple Invite Acceptance page (paste token → POST `/v1/invites/{token}/accept`).
  - [ ] Add toasts/snackbars for success/error across dashboard actions.
  - [ ] Minor polish: show “Not signed in” gate/CTA; improve empty states.
- Security/Prod Readiness
  - [ ] CORS allow-list for prod stage (currently permissive for dev).
  - [ ] Structured JSON logging + correlation IDs in all Lambdas.
  - [ ] Review IAM for remaining wildcards and narrow further where feasible.
- Docs/QA
  - [ ] `.env.local.example` with instructions to read values from SSM.
  - [ ] Postman collection with sample calls (auth header, happy-path).
  - [ ] Architecture and ERD diagrams; short runbook (alarms, budgets, common errors).
  - [ ] Minimal unit tests for create campaign, invite enqueue/accept, session create.
- CI/CD
  - [ ] Set `AWS_DEPLOY_ROLE_ARN` secret and re-enable deploy workflow if desired.

---

## Troubleshooting
- 502/500 on API calls
  - Most common cause: DB tables not created yet. Run the migration Lambda once.
  - Check CloudWatch log groups for the function name (e.g., `rpg-list-campaigns`).
- Sign-in issues
  - Ensure you verified via the email link (Cognito requires verification).
  - Confirm `.env.local` values match the new Cognito pool and client IDs.
- Messaging
  - If invites don’t send, confirm SQS URL and SNS subscription; see consumer Lambda logs.

---

## Quick Demo Path
1) Sign up → verify email via link → Sign in.
2) Dashboard: Create Campaign → copy the campaign ID.
3) Invite Player: send invite to your email.
4) Accept Invite: use the acceptance link (temporary UI via API for now; dedicated page pending).
5) Sessions: create a session for your campaign.
6) Character: create/edit your character for the campaign.

---

## Ownership
- Infra/CDK: `infrastructure/lib/*.ts`
- Migrations: `infrastructure/lambda-src/migrate.ts`, `infrastructure/sql/migrations/001_init.sql`
- API Handlers (bundled): `infrastructure/lambda-src/api.ts`
- Web App (Next.js): `web/src/*`

If you need additional context or run into issues, ping in the project channel with the CloudWatch log snippet and the API route you were calling.
