# Tabletop RPG Campaign Management Platform — A‑Grade Target TODO (AWS-Specific)

This is a trimmed plan mapped to the course rubric, implemented explicitly on AWS. It delivers an A-level scope without extra features.

---

## Rubric Coverage Map (AWS mapping)
- [ ] Client application: React/Next.js UI (deployed via `npm run dev` locally; optional S3+CloudFront omitted to keep scope small)
- [ ] Cloud API and architecture: Amazon API Gateway (REST) → AWS Lambda (Node/TS) → Amazon RDS for PostgreSQL
- [ ] API Gateway implementation: CORS, stage throttling (rate limiting), request validation models, access logging to CloudWatch Logs
- [x] Data persistence strategy (infra): RDS PostgreSQL in private subnets provisioned
- [ ] Data persistence strategy (app): schema + migration tooling
- [x] Authentication & authorization (infra): Cognito User Pool + App Client + groups
- [ ] Authentication & authorization (gateway): API Gateway JWT authorizer wired
- [ ] Message queue integration: Amazon SQS (invitation queue) → Lambda consumer → Amazon SNS email notification
- [ ] Cloud monitoring & alerting: Amazon CloudWatch dashboards and alarms (API 5xx, Lambda errors/duration, RDS CPU/storage) + AWS Budgets alert
- [x] Infrastructure as Code: AWS CDK (TypeScript) app scaffolded with stacks
- [ ] Deployment automation: GitHub Actions OIDC to assume AWS deploy role
- [ ] Documentation & presentation: README, architecture diagram, ERD, Postman collection, basic runbook
- [ ] Security best practices: TLS, least-privilege IAM, SSM Parameter Store + KMS for secrets, VPC isolation, sanitized logs, CORS allow-list

---

## Minimal Product Scope (Functional)

### Core AWS Resources
- VPC with two private subnets (for Lambdas and RDS) and two public subnets (for NAT-less if using VPC endpoints only)
- Interface VPC Endpoints: SQS, SNS, SSM (to avoid NAT costs); no internet egress from Lambdas
- RDS for PostgreSQL (db.t3.micro) in private subnets
- Cognito User Pool (email/password)
- API Gateway (REST) with JWT authorizer (Cognito)
- Lambda functions for API handlers and SQS consumer (Node/TS)
- SQS standard queue with DLQ; SNS topic for email notifications (email subscription)

### Core Flows
- GM registers/logs in (Cognito) and creates a campaign
- GM sends invite → API publishes to SQS → consumer Lambda reads and publishes to SNS → email link
- Player accepts invite and creates a simple character
- GM schedules a session (date/time only)
- Dashboard shows user’s campaigns and upcoming sessions

---

## Execution Plan (Lean MVP Epics on AWS)

### 1) Authentication & Authorization (Cognito + API Gateway JWT)
- [x] Cognito User Pool + App Client (email/password only; email verification on)
- [x] Cognito groups: `gm`, `player`; post-confirmation Lambda (optional) to default new users to `player`
- [ ] API Gateway JWT authorizer referencing User Pool; require `gm` claim on protected GM routes
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
- [ ] Models/validators for body params; consistent error shape
- [x] Endpoints:
  - [x] GET  /v1/ping (placeholder)
  - [ ] POST /v1/campaigns (GM only)
  - [ ] GET  /v1/campaigns (mine)
  - [ ] GET  /v1/campaigns/{id}
  - [ ] POST /v1/campaigns/{id}/invites (enqueue SQS)
  - [ ] POST /v1/invites/{token}/accept (join `campaign_players`)
  - [ ] POST /v1/campaigns/{id}/sessions (GM)
  - [ ] GET  /v1/campaigns/{id}/sessions
  - [ ] GET  /v1/characters/me?campaign_id=...
  - [ ] PUT  /v1/characters/me (name, class, level)
- DoD: Validated inputs, JWT required, Postman tests green.

### 4) Invitations via SQS → Lambda → SNS (MQ integration)
- [ ] SQS queue + DLQ; redrive policy; idempotency key (message de-dupe on token)
- [ ] Producer: invite endpoint publishes message (recipient email, campaign, token)
- [ ] Consumer Lambda (SQS trigger) publishes SNS email to a topic (lab-friendly, no SES sandbox work)
- [ ] SNS topic with email subscription (verify recipient in console)
- DoD: Message enqueued → consumed → email received with acceptance link.

### 5) Frontend (svelt/Next.js)
- [ ] Pages: login/register, dashboard, campaign create/detail, invite, session list/create, character page
- [ ] Amplify Auth for Cognito; fetch API with JWT in Authorization header
- [ ] Accessible form labels, basic validation, responsive layout
- DoD: All core flows performed through UI.

### 6) Security Baseline (AWS)
- [ ] IAM roles: Lambdas least privilege (RDS connect via SG, SQS send/receive, SNS publish, SSM read params)
- [ ] CloudWatch structured JSON logging with correlation IDs
- [ ] Enforce SSL at RDS; store secrets only in SSM (KMS)
- [ ] API Gateway: request validation, stage throttling, CORS allow-list
- DoD: Security checklist items satisfied; no unauthenticated mutation routes.

### 7) Monitoring, Alerting, and Cost Controls
- [ ] CloudWatch dashboards: API Gateway latency/5xx; Lambda duration/errors; RDS CPU/storage/freeable memory
- [ ] Alarms: API 5xx >1% 5m; RDS CPU >80% 10m; Lambda error rate >1% 5m
- [ ] AWS Budgets: monthly budget with email alert (or daily spend alert if required by rubric)
- DoD: Dashboards render; alarms notify; budget alert email arrives.

### 8) Infrastructure as Code & CI/CD
- [x] AWS CDK (TypeScript) app with stacks:
  - `NetworkStack` (VPC, endpoints), `DatabaseStack` (RDS, SG), `AuthStack` (Cognito), `ApiStack` (API Gateway + Lambdas)
- [ ] GitHub Actions: OIDC role in AWS; jobs for lint/test/build/deploy to dev on main
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
- [ ] CDK app skeleton; `NetworkStack`, `AuthStack`, `DatabaseStack`
- [ ] Cognito + API authorizer; RDS + migrations/seed

### Week 2
- [ ] `ApiStack` endpoints; Lambdas in VPC; validators
- [ ] `MessagingStack` SQS+DLQ, consumer Lambda, SNS email
- [ ] Frontend pages for core flows with Amplify Auth

### Week 3
- [ ] `MonitoringStack` dashboards/alarms; AWS Budgets
- [ ] GitHub Actions OIDC + deploy job
- [ ] Tests/docs/demo; freeze

---

## Final Acceptance Checklist (AWS-specific)
- [ ] React/Next.js UI demonstrates flows with forms and validation
- [ ] API Gateway (REST) with JWT authorizer; request validation; CORS; throttling
- [ ] Lambdas (Node/TS) in VPC connect to RDS Postgres (private)
- [ ] SQS queue with DLQ; consumer Lambda publishes SNS email; idempotency handled
- [ ] CloudWatch dashboards + alarms; AWS Budgets alert configured
- [ ] CDK stacks provision resources; GitHub Actions OIDC deploys to dev
- [ ] Security: least-privilege IAM, KMS-encrypted SSM params, SSL to DB, structured logs
- [ ] Documentation: README, diagrams (arch + ERD), Postman, runbook
- [ ] 5–7 minute presentation path validated end-to-end
