import { Client } from 'pg';
import crypto from 'crypto';
// Use AWS SDK v2 which is available in the Lambda runtime by default
// Avoid bundling aws-sdk; it's available in the Lambda runtime
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const AWS = eval('require')( 'aws-sdk');

type ApiEvent = {
  body?: string | null;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  requestContext?: any;
};

function getClaims(event: ApiEvent): Record<string, any> {
  const claims = event.requestContext?.authorizer?.claims || {};
  return claims;
}

async function withClient<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const secretArn = process.env.DB_SECRET_ARN!;
  const host = process.env.DB_HOST!;
  const dbName = process.env.DB_NAME || 'appdb';
  const sm = new AWS.SecretsManager();
  const sec = await sm.getSecretValue({ SecretId: secretArn }).promise();
  const creds = JSON.parse(sec.SecretString || '{}');
  const client = new Client({ host, database: dbName, user: creds.username, password: creds.password, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function ping() {
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, message: 'pong' }) };
}

export async function createCampaign(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const body = JSON.parse(event.body || '{}');
  if (!body.name) return { statusCode: 400, body: JSON.stringify({ error: 'name required' }) };
  const result = await withClient(async (db) => {
    let u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) {
      const username = (claims.email || 'user').split('@')[0];
      const fallbackEmail = claims.email || (sub + '@example.com');
      const insU = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', [fallbackEmail, username, sub]);
      u = { rows: [insU.rows[0]] } as any;
    }
    const res = await db.query('INSERT INTO campaigns (name, description, gm_id) VALUES ($1,$2,$3) RETURNING id', [body.name, body.description || null, u.rows[0].id]);
    return res.rows[0];
  });
  return { statusCode: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify(result) };
}

export async function listCampaigns(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const rows = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return [] as any[];
    const res = await db.query('SELECT DISTINCT c.id, c.name, c.description, c.status FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id = c.id WHERE c.gm_id = $1 OR cp.user_id = $1 ORDER BY c.created_at DESC LIMIT 50', [u.rows[0].id]);
    return res.rows;
  });
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: rows }) };
}

export async function getCampaign(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const id = event.pathParameters?.id;
  const row = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return null;
    const res = await db.query('SELECT c.id, c.name, c.description, c.status FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2)', [id, u.rows[0].id]);
    return res.rows[0] || null;
  });
  if (!row) return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) };
}

export async function createInvite(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const body = JSON.parse(event.body || '{}');
  const email = (body.email) || '';
  const campaignId = event.pathParameters?.id || 'unknown';
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await withClient(async (db) => {
    let u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) {
      const username = (claims.email || 'user').split('@')[0];
      const fallbackEmail = claims.email || (sub + '@example.com');
      const ins = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', [fallbackEmail, username, sub]);
      u = { rows: [ins.rows[0]] } as any;
    }
    await db.query('INSERT INTO invitations (campaign_id, email, token_hash, expires_at, created_by) VALUES ($1,$2,$3,$4,$5)', [campaignId, email, tokenHash, expiresAt, u.rows[0].id]);
  });
  const acceptancePath = '/v1/invites/' + token + '/accept';
  const sqs = new AWS.SQS();
  const messageBody = JSON.stringify({ email, campaignId, token, accept: acceptancePath, subject: 'Campaign Invite', message: 'You are invited. Use the acceptance link.' });
  await sqs.sendMessage({ QueueUrl: process.env.INVITE_QUEUE_URL!, MessageBody: messageBody }).promise();
  return { statusCode: 202, body: JSON.stringify({ ok: true }) };
}

export async function acceptInvite(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const email = claims.email || '';
  const token = event.pathParameters?.token;
  if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'invalid token' }) };
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await withClient(async (db) => {
    const inv = await db.query('SELECT campaign_id, expires_at, accepted_at FROM invitations WHERE token_hash=$1', [tokenHash]);
    if (inv.rows.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'invalid or used token' }) };
    const row = inv.rows[0];
    if (row.accepted_at) return { statusCode: 409, body: JSON.stringify({ error: 'already accepted' }) };
    if (new Date(row.expires_at).getTime() < Date.now()) return { statusCode: 410, body: JSON.stringify({ error: 'token expired' }) };
    const username = email ? email.split('@')[0] : 'user';
    const fallbackEmail = email || (sub + '@example.com');
    let u = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (cognito_user_id) DO NOTHING RETURNING id', [fallbackEmail, username, sub]);
    if (u.rows.length === 0) { u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]); }
    const userId = u.rows[0].id;
    await db.query('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [row.campaign_id, userId, 'player']);
    await db.query('UPDATE invitations SET accepted_at=NOW() WHERE token_hash=$1', [tokenHash]);
    return { statusCode: 200, body: JSON.stringify({ ok: true, campaign_id: row.campaign_id }) };
  });
  return result as any;
}

export async function createSession(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}');
  if (!body.title || !body.scheduled_at) return { statusCode: 400, body: JSON.stringify({ error: 'title and scheduled_at required' }) };
  const can = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return false;
    const own = await db.query('SELECT 1 FROM campaigns WHERE id=$1 AND gm_id=$2', [campaignId, u.rows[0].id]);
    return own.rows.length > 0;
  });
  if (!can) return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
  const row = await withClient(async (db) => {
    const res = await db.query('INSERT INTO sessions (campaign_id, title, scheduled_at, duration_minutes) VALUES ($1,$2,$3,$4) RETURNING id', [campaignId, body.title, body.scheduled_at, body.duration_minutes || 180]);
    return res.rows[0];
  });
  return { statusCode: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) };
}

export async function listSessions(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.pathParameters?.id;
  const allowed = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return false;
    const x = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, u.rows[0].id]);
    return x.rows.length > 0;
  });
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
  const rows = await withClient(async (db) => {
    const res = await db.query('SELECT id, title, scheduled_at, duration_minutes, status FROM sessions WHERE campaign_id=$1 ORDER BY scheduled_at DESC LIMIT 100', [campaignId]);
    return res.rows;
  });
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: rows }) };
}

export async function getMyCharacter(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.queryStringParameters?.campaign_id || null;
  if (!campaignId) return { statusCode: 400, body: JSON.stringify({ error: 'campaign_id required' }) };
  const row = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return null;
    const mem = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, u.rows[0].id]);
    if (mem.rows.length === 0) return 'FORBIDDEN' as any;
    const res = await db.query('SELECT id, name, class, level FROM characters WHERE campaign_id=$1 AND user_id=$2', [campaignId, u.rows[0].id]);
    return res.rows[0] || null;
  });
  if (row === 'FORBIDDEN') return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
  if (!row) return { statusCode: 404, body: JSON.stringify({ error: 'not found' }) };
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) };
}

export async function putMyCharacter(event: ApiEvent) {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const body = JSON.parse(event.body || '{}');
  const campaignId = (body.campaign_id) || null;
  if (!campaignId || !body.name || !body.class) return { statusCode: 400, body: JSON.stringify({ error: 'campaign_id, name, class required' }) };
  const result = await withClient(async (db) => {
    let u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) {
      const ins = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', ['unknown@example.com', 'user', sub]);
      u = { rows: [ins.rows[0]] } as any;
    }
    const userId = u.rows[0].id;
    const mem = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, userId]);
    if (mem.rows.length === 0) return 'FORBIDDEN' as any;
    const found = await db.query('SELECT id FROM characters WHERE campaign_id=$1 AND user_id=$2', [campaignId, userId]);
    if (found.rows.length === 0) {
      const ins = await db.query('INSERT INTO characters (campaign_id, user_id, name, class, level) VALUES ($1,$2,$3,$4,$5) RETURNING id', [campaignId, userId, body.name, body.class, body.level || 1]);
      return { id: ins.rows[0].id };
    } else {
      await db.query('UPDATE characters SET name=$3, class=$4, level=$5, updated_at=NOW() WHERE campaign_id=$1 AND user_id=$2', [campaignId, userId, body.name, body.class, body.level || 1]);
      return { id: found.rows[0].id };
    }
  });
  if (result === 'FORBIDDEN') return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(result) };
}


