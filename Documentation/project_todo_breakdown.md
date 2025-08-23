# Tabletop RPG Campaign Management Platform — A‑Grade Target TODO (AWS-Specific)

This is a trimmed plan mapped to the course rubric, implemented explicitly on AWS. It delivers an A-level scope without extra features.

---

## Rubric Coverage Map (AWS mapping)
- [ ] Client application: React/Next.js UI (deployed via `npm run dev` locally; optional S3+CloudFront omitted to keep scope small)
- [ ] Cloud API and architecture: Amazon API Gateway (REST) → AWS Lambda (Node/TS) → Amazon RDS for PostgreSQL
- [x] API Gateway implementation: CORS, stage throttling (rate limiting), request validation models, access logging to CloudWatch Logs
- [x] Data persistence strategy (infra): RDS PostgreSQL in private subnets provisioned
- [ ] Data persistence strategy (app): schema + migration tooling
- [x] Authentication & authorization (infra): Cognito User Pool + App Client + groups
- [x] Authentication & authorization (gateway): API Gateway JWT authorizer wired
- [x] Message queue integration: Amazon SQS (invitation queue) → Lambda consumer → Amazon SNS topic
- [x] Cloud monitoring & alerting: CloudWatch dashboards and alarms (API 5xx, Lambda errors, RDS CPU) + monthly AWS Budget
- [x] Infrastructure as Code: AWS CDK (TypeScript) app scaffolded with stacks
- [x] Deployment automation: GitHub Actions OIDC deploy workflow (needs `AWS_DEPLOY_ROLE_ARN` secret)
- [ ] Documentation & presentation: README, architecture diagram, ERD, Postman collection, basic runbook
- [ ] Security best practices: tighten IAM to least-privilege (replace wildcard resources), CORS allow-list for prod

---

## Minimal Product Scope (Functional)

### Core AWS Resources
- VPC with two private subnets (for Lambdas and RDS) and two public subnets (for NAT-less if using VPC endpoints only)
- Interface VPC Endpoints: SQS, SNS, SSM (to avoid NAT costs); no internet egress from Lambdas
- RDS for PostgreSQL (db.t3.micro) in private subnets
- Cognito User Pool (email/password)
- API Gateway (REST) with JWT authorizer (Cognito)
- Lambda functions for API handlers and SQS consumer (Node/TS)
- SQS standard queue with DLQ; SNS topic for notifications

### Core Flows
- GM registers/logs in (Cognito) and creates a campaign
- GM sends invite → API publishes to SQS → consumer Lambda reads and publishes to SNS → email link (subscribe your email to the SNS topic)
- Player accepts invite and creates a simple character
- GM schedules a session (date/time only)
- Dashboard shows user’s campaigns and upcoming sessions

---

## Execution Plan (Lean MVP Epics on AWS)

### 1) Authentication & Authorization (Cognito + API Gateway JWT)
- [x] Cognito User Pool + App Client (email/password only; email verification on)
- [x] Cognito groups: `gm`, `player`; post-confirmation Lambda (optional) to default new users to `player`
- [x] API Gateway JWT authorizer referencing User Pool; require `gm` claim on protected GM routes
- [ ] Frontend login/register using AWS Amplify Auth (minimal forms)
- DoD: Users can register/login; tokens validated at API; GM-only routes blocked for non-GM.

### 2) Networking & Data Layer (VPC + RDS + Migrations)
- [x] CDK VPC with 2 private subnets; security groups for Lambda ↔ RDS
- [x] VPC Interface Endpoints for SQS, SNS, SSM (no NAT Gateway required)
- [x] RDS PostgreSQL (private) with parameter group for SSL; create DB user
- [x] SSM Parameter Store (SecureString, KMS) for DB creds/URL
- [ ] Migration tooling and baseline schema for `users_map`, `campaigns`, `campaign_players`, `sessions`, `characters`, `invitations`
- DoD: Lambdas in VPC connect to RDS via SG; migrations/seed succeed locally and in CI.

### 3) REST API (API Gateway → Lambda)
- [x] Stage CORS allow-list (ALL origins for dev) and JSON access logs
- [x] Stage throttling (e.g., 50 RPS, burst 100)
- [x] Models/validators for body params; consistent error shape
- [x] Endpoints:
  - [x] GET  /v1/ping (placeholder)
  - [x] POST /v1/campaigns (GM only)
  - [x] GET  /v1/campaigns (mine)
  - [x] GET  /v1/campaigns/{id}
  - [x] POST /v1/campaigns/{id}/invites (enqueue SQS)
  - [ ] POST /v1/invites/{token}/accept (join `campaign_players`)
  - [ ] POST /v1/campaigns/{id}/sessions (GM)
  - [ ] GET  /v1/campaigns/{id}/sessions
  - [ ] GET  /v1/characters/me?campaign_id=...
  - [ ] PUT  /v1/characters/me (name, class, level)
- DoD: Validated inputs, JWT required, Postman tests green.

### 4) Invitations via SQS → Lambda → SNS (MQ integration)
- [x] SQS queue + DLQ; redrive policy; idempotency key (message de-dupe on token) [pending idempotency]
- [x] Producer: invite endpoint publishes message (recipient email, campaign, token)
- [x] Consumer Lambda (SQS trigger) publishes SNS email to a topic (subscribe your email)
- [ ] SNS topic subscription documented in README
- DoD: Message enqueued → consumed → email received with acceptance link.

### 5) Frontend (svelt/Next.js)
- [ ] Pages: login/register, dashboard, campaign create/detail, invite, session list/create, character page
- [ ] Amplify Auth for Cognito; fetch API with JWT in Authorization header
- [ ] Accessible form labels, basic validation, responsive layout
- DoD: All core flows performed through UI.

### 6) Security Baseline (AWS)
- [ ] IAM roles: tighten to least privilege (replace wildcard resources with ARNs)
- [ ] CloudWatch structured JSON logging with correlation IDs
- [ ] Enforce SSL at RDS; store secrets only in SSM/Secrets (KMS)
- [ ] API Gateway: request validation, stage throttling, CORS allow-list (prod)
- DoD: Security checklist items satisfied; no unauthenticated mutation routes.

### 7) Monitoring, Alerting, and Cost Controls
- [x] CloudWatch dashboards: API Gateway latency/5xx; Lambda errors; RDS CPU
- [x] Alarms: API 5xx >1% 5m; RDS CPU >80% 10m; Lambda errors
- [x] AWS Budgets: monthly budget with optional email alert
- DoD: Dashboards render; alarms notify; budget alert email arrives.

### 8) Infrastructure as Code & CI/CD
- [x] AWS CDK (TypeScript) app with stacks:
  - `NetworkStack` (VPC, endpoints), `DatabaseStack` (RDS, SG), `AuthStack` (Cognito), `MessagingStack` (SQS+DLQ, SNS), `ApiStack` (API Gateway + Lambdas), `MonitoringStack` (dashboards/alarms)
- [x] GitHub Actions: OIDC role in AWS; jobs for build/deploy to dev on main (requires secret)
- [ ] CDK context for envs; secrets resolved via SSM at deploy/runtime
- DoD: `git push` to main deploys CDK and Lambdas to dev.

### 9) QA & Docs
- [ ] Unit tests for create campaign, invite enqueue, accept invite, create session
- [ ] Postman collection + environment; README quickstart; architecture diagram; ERD; runbook for alarms
- [ ] Short demo script: register → login → create campaign → invite → accept → create session → view dashboard
- DoD: CI green; artifacts committed; 5–7 minute demo runnable.

---

## De-scoped Items (kept out intentionally)
- WebSockets/AppSync real-time features
- Analytics/metrics store beyond CloudWatch dashboards
- S3 content uploads, handouts, maps
- Advanced character sheet mechanics
- Attendance tracking and automated recaps
- Public web hosting/CDN; full PWA/offline

---

## Week-by-Week (Compressed on AWS)

### Week 1
- [x] CDK app skeleton; `NetworkStack`, `AuthStack`, `DatabaseStack`
- [x] Cognito + API authorizer; RDS + migrations/seed (files added)

### Week 2
- [x] `ApiStack` endpoints; Lambdas in VPC; validators (campaigns + invites)
- [x] `MessagingStack` SQS+DLQ, consumer Lambda, SNS topic
- [ ] Frontend pages for core flows with Amplify Auth

### Week 3
- [x] `MonitoringStack` dashboards/alarms; AWS Budgets
- [ ] GitHub Actions OIDC + deploy job (configured; needs secret)
- [ ] Tests/docs/demo; freeze

---

## Final Acceptance Checklist (AWS-specific)
- [ ] React/Next.js UI demonstrates flows with forms and validation
- [x] API Gateway (REST) with JWT authorizer; request validation; CORS; throttling
- [x] Lambdas (Node/TS) in VPC connect to RDS Postgres (private)
- [x] SQS queue with DLQ; consumer Lambda publishes SNS email
- [x] CloudWatch dashboards + alarms; AWS Budgets alert configured
- [x] CDK stacks provision resources; GitHub Actions OIDC deploys to dev (needs role secret)
- [ ] Security: least-privilege IAM, KMS-encrypted SSM params, SSL to DB, structured logs
- [ ] Documentation: README, diagrams (arch + ERD), Postman, runbook
- [ ] 5–7 minute presentation path validated end-to-end
