import { Client } from 'pg';
import crypto from 'crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

type ApiEvent = {
  body?: string | null;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  requestContext?: any;
};

type LambdaResponse = { statusCode: number; headers?: Record<string, string>; body: string };

const DEBUG_ERRORS = process.env.DEBUG_ERRORS === 'true';

function json(statusCode: number, body: unknown, requestId?: string): LambdaResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    body: JSON.stringify(body),
  };
}

function mapError(err: any): { status: number; code: string; message: string } {
  // PG errors
  const code = err?.code as string | undefined;
  if (code) {
    switch (code) {
      case '23505': // unique_violation
        return { status: 409, code: 'unique_violation', message: err?.detail || 'Duplicate value' };
      case '23503': // foreign_key_violation
        return { status: 400, code: 'foreign_key_violation', message: err?.detail || 'Invalid reference' };
      case '22P02': // invalid_text_representation
        return { status: 400, code: 'invalid_identifier', message: 'Invalid identifier' };
      default:
        return { status: 500, code: 'database_error', message: DEBUG_ERRORS ? (err?.message || 'Database error') : 'Internal error' };
    }
  }
  // AWS or generic errors
  if (typeof err?.name === 'string') {
    return { status: 500, code: err.name, message: DEBUG_ERRORS ? (err?.message || 'Internal error') : 'Internal error' };
  }
  return { status: 500, code: 'internal_error', message: DEBUG_ERRORS ? (err?.message || 'Internal error') : 'Internal error' };
}

function withErrors(
  handler: (event: ApiEvent, requestId: string) => Promise<LambdaResponse | object>
): (event: ApiEvent) => Promise<LambdaResponse> {
  return async (event: ApiEvent) => {
    const requestId = event.requestContext?.requestId || '';
    try {
      const result = await handler(event, requestId);
      if (result && typeof (result as any).statusCode === 'number' && typeof (result as any).body === 'string') {
        const resp = result as LambdaResponse;
        return {
          ...resp,
          headers: {
            'content-type': 'application/json',
            ...(requestId ? { 'x-request-id': requestId } : {}),
            ...(resp.headers || {}),
          },
        };
      }
      return json(200, result, requestId);
    } catch (err: any) {
      const mapped = mapError(err);
      const payload: any = { error: mapped.code, message: mapped.message, requestId };
      if (DEBUG_ERRORS) {
        payload.details = {
          name: err?.name,
          code: err?.code,
          detail: err?.detail,
        };
      }
      console.error('handler_error', { requestId, error: err });
      return json(mapped.status, payload, requestId);
    }
  };
}

function getClaims(event: ApiEvent): Record<string, any> {
  const claims = event.requestContext?.authorizer?.claims || {};
  return claims;
}

async function withClient<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const secretArn = process.env.DB_SECRET_ARN!;
  const host = process.env.DB_HOST!;
  const dbName = process.env.DB_NAME || 'appdb';
  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const creds = JSON.parse(sec.SecretString || '{}');
  const client = new Client({ host, database: dbName, user: creds.username, password: creds.password, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export const ping = withErrors(async (_event, requestId) => json(200, { ok: true, message: 'pong' }, requestId));

export const createCampaign = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const body = JSON.parse(event.body || '{}');
  if (!body.name) return json(400, { error: 'bad_request', message: 'name required', requestId }, requestId);
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
  return json(201, result, requestId);
});

export const listCampaigns = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const rows = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return [] as any[];
    const res = await db.query('SELECT DISTINCT c.id, c.name, c.description, c.status, c.created_at FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id = c.id WHERE c.gm_id = $1 OR cp.user_id = $1 ORDER BY c.created_at DESC LIMIT 50', [u.rows[0].id]);
    return res.rows;
  });
  return json(200, { items: rows }, requestId);
});

export const deleteCampaign = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const id = event.pathParameters?.id;
  if (!id) return json(400, { error: 'bad_request', message: 'id required', requestId }, requestId);
  const result = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return 'FORBIDDEN' as any;
    // Only GM can delete the campaign. Cascades will remove children.
    const del = await db.query('DELETE FROM campaigns WHERE id=$1 AND gm_id=$2 RETURNING id', [id, u.rows[0].id]);
    if (del.rows.length === 0) return 'FORBIDDEN' as any;
    return { ok: true };
  });
  if (result === 'FORBIDDEN') return json(403, { error: 'forbidden', message: 'only GM can delete', requestId }, requestId);
  return json(200, result, requestId);
});

export const getCampaign = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const id = event.pathParameters?.id;
  const row = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return null;
    const res = await db.query('SELECT c.id, c.name, c.description, c.status FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2)', [id, u.rows[0].id]);
    return res.rows[0] || null;
  });
  if (!row) return json(403, { error: 'forbidden', message: 'not a member of this campaign', requestId }, requestId);
  return json(200, row, requestId);
});

export const createInvite = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const body = JSON.parse(event.body || '{}');
  const email = (body.email) || '';
  const campaignId = event.pathParameters?.id || 'unknown';
  
  console.log('createInvite called', { requestId, sub, email, campaignId });
  
  if (!email) return json(400, { error: 'bad_request', message: 'email required', requestId }, requestId);
  
  // Validate campaign ID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(campaignId)) {
    console.log('Invalid campaign ID format', { campaignId });
    return json(400, { error: 'bad_request', message: 'Invalid campaign ID format', requestId }, requestId);
  }
  
  // Validate campaign exists and user has permission to invite
  const campaignValidation = await withClient(async (db) => {
    console.log('Starting database validation', { requestId });
    
    let u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    console.log('User query result', { requestId, userRows: u.rows.length });
    
    if (u.rows.length === 0) {
      console.log('Creating new user', { requestId, sub });
      const username = (claims.email || 'user').split('@')[0];
      const fallbackEmail = claims.email || (sub + '@example.com');
      const ins = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', [fallbackEmail, username, sub]);
      u = { rows: [ins.rows[0]] } as any;
      console.log('New user created', { requestId, userId: u.rows[0].id });
    }
    
    // Check if campaign exists and user is the GM
    console.log('Checking campaign permissions', { requestId, campaignId, userId: u.rows[0].id });
    const campaign = await db.query('SELECT id FROM campaigns WHERE id=$1 AND gm_id=$2', [campaignId, u.rows[0].id]);
    console.log('Campaign query result', { requestId, campaignRows: campaign.rows.length });
    
    if (campaign.rows.length === 0) {
      console.log('Campaign not found or user not GM', { requestId, campaignId, userId: u.rows[0].id });
      return { error: 'forbidden', message: 'Campaign not found or you are not the Game Master' };
    }
    
    // Check if email is already invited to this campaign
    console.log('Checking for existing invite', { requestId, campaignId, email });
    const existingInvite = await db.query('SELECT id FROM invitations WHERE campaign_id=$1 AND email=$2 AND accepted_at IS NULL', [campaignId, email]);
    console.log('Existing invite check result', { requestId, existingInviteRows: existingInvite.rows.length });
    
    if (existingInvite.rows.length > 0) {
      console.log('Duplicate invite found', { requestId, campaignId, email });
      return { error: 'duplicate_invite', message: 'This email is already invited to this campaign' };
    }
    
    console.log('Validation successful', { requestId, userId: u.rows[0].id });
    return { userId: u.rows[0].id };
  });
  
  if ('error' in campaignValidation) {
    console.log('Validation failed', { requestId, error: campaignValidation.error });
    return json(403, { error: campaignValidation.error, message: campaignValidation.message, requestId }, requestId);
  }
  
  console.log('Creating invitation', { requestId, campaignId, email, userId: campaignValidation.userId });
  
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await withClient(async (db) => {
    console.log('Inserting invitation into database', { requestId, campaignId, email, tokenHash });
    await db.query('INSERT INTO invitations (campaign_id, email, token_hash, expires_at, created_by) VALUES ($1,$2,$3,$4,$5)', [campaignId, email, tokenHash, expiresAt, campaignValidation.userId]);
    console.log('Invitation inserted successfully', { requestId });
  });
  
  // Build API base URL from request context to avoid stack circular refs
  const domainName = (event.requestContext as any)?.domainName;
  const stage = (event.requestContext as any)?.stage;
  const envBase = (process.env.API_BASE_URL || '').replace(/\/$/, '');
  const apiBaseUrl = (domainName && stage) ? `https://${domainName}/${stage}` : envBase;
  const acceptanceUrl = `${apiBaseUrl}/v1/invites/${token}/accept`;
  console.log('Sending to SQS', { requestId, queueUrl: process.env.INVITE_QUEUE_URL });
  const sqs = new SQSClient({});
  const messageBody = JSON.stringify({ 
    email, 
    campaignId, 
    token, 
    accept: acceptanceUrl, 
    subject: 'Campaign Invite', 
    message: 'You have been invited to join a tabletop RPG campaign! Click the link below to accept your invitation and start your adventure.' 
  });
  
  try {
    await sqs.send(new SendMessageCommand({ QueueUrl: process.env.INVITE_QUEUE_URL!, MessageBody: messageBody }));
    console.log('SQS message sent successfully', { requestId });
  } catch (sqsError) {
    console.error('SQS error', { requestId, error: sqsError });
    // Don't fail the entire operation if SQS fails - the invitation was still created
    // Just log the error and continue
  }
  
  return json(202, { ok: true }, requestId);
});

export const acceptInvite = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'] || 'unknown-sub';
  const email = claims.email || '';
  const token = event.pathParameters?.token;
  if (!token) return json(400, { error: 'bad_request', message: 'invalid token', requestId }, requestId);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await withClient(async (db) => {
    const inv = await db.query('SELECT campaign_id, expires_at, accepted_at FROM invitations WHERE token_hash=$1', [tokenHash]);
    if (inv.rows.length === 0) return json(400, { error: 'invalid_token', message: 'invalid or used token', requestId }, requestId);
    const row = inv.rows[0];
    if (row.accepted_at) return json(409, { error: 'already_accepted', message: 'invite already accepted', requestId }, requestId);
    if (new Date(row.expires_at).getTime() < Date.now()) return json(410, { error: 'expired', message: 'token expired', requestId }, requestId);
    const username = email ? email.split('@')[0] : 'user';
    const fallbackEmail = email || (sub + '@example.com');
    let u = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (cognito_user_id) DO NOTHING RETURNING id', [fallbackEmail, username, sub]);
    if (u.rows.length === 0) { u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]); }
    const userId = u.rows[0].id;
    await db.query('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [row.campaign_id, userId, 'player']);
    await db.query('UPDATE invitations SET accepted_at=NOW() WHERE token_hash=$1', [tokenHash]);
    return json(200, { ok: true, campaign_id: row.campaign_id, requestId }, requestId);
  });
  // If inner returned a response, pass-through
  if ((result as any).statusCode) return result as LambdaResponse;
  return json(200, result, requestId);
});

export const createSession = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}');
  if (!body.title || !body.scheduled_at) return json(400, { error: 'bad_request', message: 'title and scheduled_at required', requestId }, requestId);
  const can = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return false;
    const own = await db.query('SELECT 1 FROM campaigns WHERE id=$1 AND gm_id=$2', [campaignId, u.rows[0].id]);
    return own.rows.length > 0;
  });
  if (!can) return json(403, { error: 'forbidden', message: 'only GM can create sessions', requestId }, requestId);
  const row = await withClient(async (db) => {
    const res = await db.query('INSERT INTO sessions (campaign_id, title, scheduled_at, duration_minutes) VALUES ($1,$2,$3,$4) RETURNING id', [campaignId, body.title, body.scheduled_at, body.duration_minutes || 180]);
    return res.rows[0];
  });
  return json(201, row, requestId);
});

export const listSessions = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.pathParameters?.id;
  const allowed = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return false;
    const x = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, u.rows[0].id]);
    return x.rows.length > 0;
  });
  if (!allowed) return json(403, { error: 'forbidden', message: 'not a member of this campaign', requestId }, requestId);
  const rows = await withClient(async (db) => {
    const res = await db.query('SELECT id, title, scheduled_at, duration_minutes, status FROM sessions WHERE campaign_id=$1 ORDER BY scheduled_at DESC LIMIT 100', [campaignId]);
    return res.rows;
  });
  return json(200, { items: rows }, requestId);
});

export const deleteSession = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.pathParameters?.id;
  const sessionId = event.pathParameters?.sessionId;
  if (!campaignId || !sessionId) return json(400, { error: 'bad_request', message: 'campaign and session required', requestId }, requestId);
  const ok = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return false;
    // Any member of the campaign (GM or player) may delete the session
    const mem = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, u.rows[0].id]);
    if (mem.rows.length === 0) return false;
    await db.query('DELETE FROM sessions WHERE id=$1 AND campaign_id=$2', [sessionId, campaignId]);
    return true;
  });
  if (!ok) return json(403, { error: 'forbidden', message: 'not a member of this campaign', requestId }, requestId);
  return json(200, { ok: true }, requestId);
});

export const getMyCharacter = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const campaignId = event.queryStringParameters?.campaign_id || null;
  if (!campaignId) return json(400, { error: 'bad_request', message: 'campaign_id required', requestId }, requestId);
  const row = await withClient(async (db) => {
    const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
    if (u.rows.length === 0) return null;
    const mem = await db.query('SELECT 1 FROM campaigns c LEFT JOIN campaign_players cp ON cp.campaign_id=c.id WHERE c.id=$1 AND (c.gm_id=$2 OR cp.user_id=$2) LIMIT 1', [campaignId, u.rows[0].id]);
    if (mem.rows.length === 0) return 'FORBIDDEN' as any;
    const res = await db.query('SELECT id, name, class, level FROM characters WHERE campaign_id=$1 AND user_id=$2', [campaignId, u.rows[0].id]);
    return res.rows[0] || null;
  });
  if (row === 'FORBIDDEN') return json(403, { error: 'forbidden', message: 'not a member of this campaign', requestId }, requestId);
  if (!row) return json(404, { error: 'not_found', message: 'character not found', requestId }, requestId);
  return json(200, row, requestId);
});

export const putMyCharacter = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const sub = claims.sub || claims['cognito:username'];
  const body = JSON.parse(event.body || '{}');
  const campaignId = (body.campaign_id) || null;
  if (!campaignId || !body.name || !body.class) return json(400, { error: 'bad_request', message: 'campaign_id, name, class required', requestId }, requestId);
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
  if (result === 'FORBIDDEN') return json(403, { error: 'forbidden', message: 'not a member of this campaign', requestId }, requestId);
  return json(200, result, requestId);
});

// Admin APIs
const idp = new CognitoIdentityProviderClient({});

export const listUsersAdmin = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const groups = (claims['cognito:groups'] as string | undefined)?.split(',') || [];
  if (!groups.includes('admin')) return json(403, { error: 'forbidden', message: 'admin only', requestId }, requestId);
  const userPoolId = process.env.USER_POOL_ID!;
  const resp = await idp.send(new ListUsersCommand({ UserPoolId: userPoolId, Limit: 50 }));
  return json(200, { users: resp.Users?.map(u => ({ username: u.Username, status: u.UserStatus, enabled: u.Enabled, attributes: u.Attributes })) || [] }, requestId);
});

export const deleteUserAdmin = withErrors(async (event, requestId) => {
  const claims = getClaims(event);
  const groups = (claims['cognito:groups'] as string | undefined)?.split(',') || [];
  if (!groups.includes('admin')) return json(403, { error: 'forbidden', message: 'admin only', requestId }, requestId);
  const userPoolId = process.env.USER_POOL_ID!;
  const username = event.pathParameters?.username;
  if (!username) return json(400, { error: 'bad_request', message: 'username required', requestId }, requestId);
  await idp.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  return json(200, { ok: true }, requestId);
});


