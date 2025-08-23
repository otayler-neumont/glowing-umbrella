import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    gm_id UUID REFERENCES users(id),
    max_players INTEGER DEFAULT 6,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'player',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 180,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_attendance (
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'invited',
    checked_in_at TIMESTAMP,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
`;

const SEED_SQL = `
INSERT INTO users (id, email, username, cognito_user_id)
VALUES (gen_random_uuid(), 'gm@example.com', 'demo_gm', 'cognito-demo-gm')
ON CONFLICT (email) DO NOTHING;

WITH gm AS (
  SELECT id FROM users WHERE email = 'gm@example.com' LIMIT 1
)
INSERT INTO campaigns (id, name, description, gm_id)
SELECT gen_random_uuid(), 'Demo Campaign', 'A seeded demo campaign', gm.id FROM gm
ON CONFLICT DO NOTHING;
`;

export const handler = async () => {
  const secretArn = process.env.DB_SECRET_ARN!;
  const host = process.env.DB_HOST!;
  const database = process.env.DB_NAME || 'appdb';
  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const creds = JSON.parse(sec.SecretString || '{}');

  const client = new Client({
    host,
    database,
    user: creds.username,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(MIGRATION_SQL);
    await client.query(SEED_SQL);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed', err);
    throw err;
  } finally {
    await client.end();
  }
  return { statusCode: 200, body: 'migrated' };
};
