export const amplifyAuthConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: { email: true },
      region: process.env.NEXT_PUBLIC_REGION,
    },
  },
} as const;

const rawApiBase = process.env.NEXT_PUBLIC_API_BASE || '';
export const apiBase = rawApiBase.replace(/\/$/, '');
