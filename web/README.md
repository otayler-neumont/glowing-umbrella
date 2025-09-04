Web App (Next.js)
=================

Next.js 15 (App Router, Turbopack) frontend for the Tabletop RPG Platform. Uses AWS Amplify Auth (Cognito) and proxies backend API calls via a Next.js route.

## Prerequisites

- Node.js 18+
- Cognito User Pool and App Client (from `infrastructure` deploy)
- API Gateway URL (from `infrastructure` deploy)

## Environment

Create `.env.local` in `web/` with:

```
NEXT_PUBLIC_COGNITO_USER_POOL_ID=...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
NEXT_PUBLIC_REGION=us-east-2
NEXT_PUBLIC_API_BASE=https://<rest-api-id>.execute-api.us-east-2.amazonaws.com/prod
```

Helper: run `add_env.bat` to append `NEXT_PUBLIC_API_BASE`.

## Scripts

```bash
npm run dev     # Next dev server (Turbopack)
npm run build   # Production build
npm start       # Start production server
npm run lint    # Lint
```

## Local Development

1. Ensure infrastructure is deployed and env vars are set.
2. Run `npm run dev` and open http://localhost:3000.
3. Sign up/sign in at `/auth`.
4. Use `/dashboard` to create campaigns, invite players, and manage sessions/characters.

## App Routes Overview

## API Overview (Next.js App Routes)

- Base path: `/api`
- Content type: form data (`multipart/form-data` via `FormData`)

### Endpoints

- POST `/api/auth/signup`
  - Body (form fields): `email`, `password`
  - Success: 302 redirect to `/auth`
  - Error: 400 `{ "error": "message" }`

- POST `/api/auth/signin`
  - Body (form fields): `email`, `password`
  - Side effect: sets `amplify_username` HTTP-only cookie
  - Success: 302 redirect to `/dashboard`
  - Error: 400 `{ "error": "message" }`

- POST `/api/auth/confirm`
  - Body (form fields): `email`, `code`
  - Success: 302 redirect to `/auth`
  - Error: 400 `{ "error": "message" }`

## Backend Calls (via Proxy)

- All backend calls go through `GET/POST /api/proxy/...` which forwards to `${NEXT_PUBLIC_API_BASE}` and passes `Authorization` and `Content-Type` headers.
- Examples the app uses:
  - `GET /api/proxy/v1/ping` → public health
  - `GET /api/proxy/v1/campaigns` → requires `Authorization: Bearer <idToken>`; returns `{ items: [...] }`.
  - `POST /api/proxy/v1/campaigns` with JSON body `{ name, description? }`.
  - `DELETE /api/proxy/v1/campaigns/{id}`.
  - `POST /api/proxy/v1/campaigns/{id}/invites` with `{ email }`.
  - `GET /api/proxy/v1/characters/me?campaign_id=...` and `PUT` to update.

## Auth and Data Flow

- Amplify is configured with Cognito values from env (`src/lib/aws.ts`, `src/lib/amplify-client.ts`).
- Server routes call helpers in `app/api/auth/route-helpers.ts`:
  - `doSignup(email, password)` → Cognito signUp
  - `doConfirm(email, code)` → Cognito confirmSignUp
  - `doSignin(email, password)` → Cognito signIn
- Client sections use `fetchAuthSession()` to obtain `idToken`, then call `/api/proxy/...` with `Authorization: Bearer <idToken>`.
- Dashboard health will render "Not signed in" instead of erroring when unauthenticated.

## Required Environment Variables

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_REGION`
- `NEXT_PUBLIC_API_BASE` (e.g., `https://abc123.execute-api.us-east-2.amazonaws.com/prod`)
