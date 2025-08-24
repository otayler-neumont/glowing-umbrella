RPG Platform Postman Resources
=============================

Files in this folder:

- `rpg-api.postman_collection.json` — REST API Gateway endpoints under `/v1`.
- `web-app.postman_collection.json` — Next.js app routes under `/api` for Cognito auth.
- `Prod.postman_environment.json` — Environment with `api_base` set to the prod stage URL from the console screenshot (`https://80a9vnlf62.execute-api.us-east-2.amazonaws.com/prod`).
- `Local.postman_environment.json` — Environment for local web testing (`web_base=http://localhost:3000`).

Usage
-----

1. Import collections and an environment into Postman.
2. Select `RPG Prod` when testing the backend API collection. Set variables:
   - `id_token` — Cognito JWT (ID token). Obtain via the web app sign-in or Amplify CLI.
   - `campaign_id` — Fill after creating a campaign.
   - `invite_token` — For MVP this equals a campaign ID.
3. For web app routes, select `RPG Local` (or your deployed site URL by duplicating the env and updating `web_base`).

Notes
-----

- All protected API routes require header `Authorization: Bearer {{id_token}}`.
- `GET /v1/ping` is public and useful for health checks.
- Update environment values if your API stage URL changes.


