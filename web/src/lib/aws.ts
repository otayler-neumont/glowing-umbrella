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

export const apiBase = process.env.NEXT_PUBLIC_API_BASE!.replace(/\/$/, '');
