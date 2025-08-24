# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## API Overview (from ApiStack)

- Base path: `/v1`
- Authentication: Cognito User Pools JWT via `Authorization: Bearer <token>` header (all endpoints require auth unless noted)
- CORS: All origins, headers `Authorization, Content-Type`, methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Logging: API Gateway access logs enabled

### Endpoints

- GET `/v1/ping`
  - Auth: Not required
  - Body: none
  - 200: `{ "ok": true, "message": "pong" }`

- POST `/v1/campaigns`
  - Auth: Required
  - Body (JSON):
    ```json
    { "name": "string", "description": "string (optional)" }
    ```
  - 201: `{ "id": "uuid" }`
  - 400: `{ "error": "name required" }`

- GET `/v1/campaigns`
  - Auth: Required
  - Body: none
  - 200: `{ "items": [ { "id": "uuid", "name": "string", "description": "string|null", "status": "string" } ] }`

- GET `/v1/campaigns/{id}`
  - Auth: Required
  - Body: none
  - 200: `{ "id": "uuid", "name": "string", "description": "string|null", "status": "string" }`
  - 404: `{ "error": "not found" }`

- POST `/v1/campaigns/{id}/invites`
  - Auth: Required
  - Validation: Request model enforces `email` as a valid email string
  - Body (JSON):
    ```json
    { "email": "user@example.com" }
    ```
  - 202: `{ "ok": true }`
  - 400: `{ "error": "email required" }`

- POST `/v1/invites/{token}/accept`
  - Auth: Required
  - Body: none (path `token` currently represents `campaignId` in MVP)
  - 200: `{ "ok": true }`
  - 400/500 on invalid token or user upsert failure

- POST `/v1/campaigns/{id}/sessions`
  - Auth: Required
  - Body (JSON):
    ```json
    { "title": "string", "scheduled_at": "ISO timestamp", "duration_minutes": 180 }
    ```
  - 201: `{ "id": "uuid" }`
  - 400: `{ "error": "title and scheduled_at required" }`

- GET `/v1/campaigns/{id}/sessions`
  - Auth: Required
  - Body: none
  - 200: `{ "items": [ { "id": "uuid", "title": "string", "scheduled_at": "ISO timestamp", "duration_minutes": number, "status": "string" } ] }`

- GET `/v1/characters/me?campaign_id={uuid}`
  - Auth: Required
  - Body: none
  - 200: `{ "id": "uuid", "name": "string", "class": "string", "level": number }`
  - 400: `{ "error": "campaign_id required" }`
  - 404: `{ "error": "not found" }`

- PUT `/v1/characters/me`
  - Auth: Required
  - Body (JSON):
    ```json
    { "campaign_id": "uuid", "name": "string", "class": "string", "level": 1 }
    ```
  - 200: `{ "id": "uuid" }`
  - 400: `{ "error": "campaign_id, name, class required" }`

### System Flow

- Authentication
  - Users sign up/sign in via Cognito User Pool. The API uses a Cognito User Pools Authorizer; include the JWT access token in `Authorization` header for protected routes.

- Campaign Management
  - Create a campaign via `POST /v1/campaigns`. List and fetch campaigns via `GET /v1/campaigns` and `GET /v1/campaigns/{id}`.

- Invites
  - `POST /v1/campaigns/{id}/invites` enqueues an invite message to SQS (queue URL from SSM: `/rpg/mq/inviteQueueUrl`).
  - A Lambda consumer processes SQS messages and publishes notifications to SNS.
  - Recipient accepts via `POST /v1/invites/{token}/accept` (MVP: `token` equals `campaignId`). The API upserts the Cognito user into `users` and adds them to `campaign_players`.

- Sessions
  - Create sessions for a campaign with `POST /v1/campaigns/{id}/sessions`. Retrieve with `GET /v1/campaigns/{id}/sessions`.

- Characters
  - Retrieve your character for a campaign via `GET /v1/characters/me?campaign_id=...`.
  - Create/update your character via `PUT /v1/characters/me`.

### Infrastructure Wiring (high level)

- API Gateway REST API `rpg-api` exposes the `/v1` routes above.
- Cognito User Pool and Client IDs/ARNs are stored in SSM under `/rpg/auth/*` and imported by the API for JWT auth.
- Database connectivity uses Secrets Manager (credentials) and SSM (`/rpg/db/endpoint`, `/rpg/db/secretArn`). Inline Lambdas connect to Postgres to fulfill requests.
- Messaging uses SQS (invite queue with DLQ) and SNS (notifications). Queue URL is published to SSM at `/rpg/mq/inviteQueueUrl`.
