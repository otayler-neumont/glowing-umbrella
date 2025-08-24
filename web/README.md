This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

## Outbound Backend API Calls

- GET `${NEXT_PUBLIC_API_BASE}/v1/ping`
  - No auth header used

- GET `${NEXT_PUBLIC_API_BASE}/v1/campaigns`
  - Auth: `Authorization: <Cognito idToken>` header
  - Returns `{ items: [...] }`

## Auth and Data Flow

- Amplify is configured with Cognito values from env (`src/lib/aws.ts`, `src/lib/amplify-client.ts`).
- Server routes call helpers in `app/api/auth/route-helpers.ts`:
  - `doSignup(email, password)` → Cognito signUp
  - `doConfirm(email, code)` → Cognito confirmSignUp
  - `doSignin(email, password)` → Cognito signIn
- Client data fetch (`dashboard/sections/client-campaigns.tsx`):
  - Uses `fetchAuthSession()` to obtain `idToken` and calls `${apiBase}/v1/campaigns` with `Authorization` header.
  - Dashboard also calls `${apiBase}/v1/ping` for health.

## Required Environment Variables

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_REGION`
- `NEXT_PUBLIC_API_BASE` (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`)
