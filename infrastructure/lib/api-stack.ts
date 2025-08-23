import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw, aws_lambda as lambda, aws_logs as logs, aws_ec2 as ec2, aws_ssm as ssm, aws_cognito as cognito, aws_iam as iam, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';

export interface ApiStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	lambdaSecurityGroup: ec2.ISecurityGroup;
	userPoolArnParamName: string; // e.g., /rpg/auth/userPoolArn
}

export class ApiStack extends cdk.Stack {
	public readonly restApi: apigw.RestApi;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		// Create CloudWatch Logs role for API Gateway
		const cloudWatchLogsRole = new iam.Role(this, 'ApiGatewayCloudWatchLogsRole', {
			assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
			],
		});

		const logGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
			retention: logs.RetentionDays.ONE_WEEK,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		this.restApi = new apigw.RestApi(this, 'RestApi', {
			restApiName: 'rpg-api',
			deployOptions: {
				loggingLevel: apigw.MethodLoggingLevel.INFO,
				dataTraceEnabled: false,
				metricsEnabled: true,
				throttlingBurstLimit: 100,
				throttlingRateLimit: 50,
				accessLogDestination: new apigw.LogGroupLogDestination(logGroup),
				accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
			},
			defaultCorsPreflightOptions: {
				allowOrigins: apigw.Cors.ALL_ORIGINS,
				allowHeaders: ['Authorization', 'Content-Type'],
				allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			},
		});

		const userPoolArn = ssm.StringParameter.valueForStringParameter(this, props.userPoolArnParamName);
		const importedPool = cognito.UserPool.fromUserPoolArn(this, 'ImportedUserPool', userPoolArn);
		const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'JwtAuthorizer', {
			cognitoUserPools: [importedPool],
		});

		// Request model and validator for POST /invites
		const inviteModel = new apigw.Model(this, 'InviteModel', {
			restApi: this.restApi,
			contentType: 'application/json',
			modelName: 'InviteRequest',
			schema: {
				schema: apigw.JsonSchemaVersion.DRAFT4,
				title: 'InviteRequest',
				type: apigw.JsonSchemaType.OBJECT,
				required: ['email'],
				properties: {
					email: { type: apigw.JsonSchemaType.STRING, format: 'email' },
				},
			},
		});
		const bodyValidator = new apigw.RequestValidator(this, 'BodyValidator', {
			restApi: this.restApi,
			validateRequestBody: true,
			validateRequestParameters: false,
		});

		// Common function settings for API handlers
		const commonLambdaProps: Omit<lambda.FunctionProps, 'code' | 'handler' | 'functionName'> = {
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 256,
			timeout: cdk.Duration.seconds(10),
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
				DB_SECRET_ARN: ssm.StringParameter.valueForStringParameter(this, '/rpg/db/secretArn'),
				DB_HOST: ssm.StringParameter.valueForStringParameter(this, '/rpg/db/endpoint'),
				DB_NAME: 'appdb',
			},
		};

		// Allow functions to read DB secret
		const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', commonLambdaProps.environment!.DB_SECRET_ARN);

		// Public health check endpoint (optional)
		const pingHandler = new lambda.Function(this, 'PingHandler', {
			...commonLambdaProps,
			functionName: 'rpg-ping',
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async()=>({statusCode:200,headers:{"content-type":"application/json"},body:JSON.stringify({ok:true,message:"pong"})});'),
		});
		dbSecret.grantRead(pingHandler);

		const v1 = this.restApi.root.addResource('v1');
		v1.addResource('ping').addMethod('GET', new apigw.LambdaIntegration(pingHandler));

		// Simple pg helper inline
		const pgHelper = `
			const { Client } = require('pg');
			async function withClient(fn){
			  const secretArn = process.env.DB_SECRET_ARN;
			  const host = process.env.DB_HOST;
			  const db = process.env.DB_NAME;
			  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
			  const sm = new SecretsManagerClient({});
			  const sec = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
			  const creds = JSON.parse(sec.SecretString||'{}');
			  const client = new Client({ host, database: db, user: creds.username, password: creds.password, ssl: { rejectUnauthorized: false } });
			  await client.connect();
			  try { return await fn(client); } finally { await client.end(); }
			}
		`;

		// Campaign CRUD (basic)
		const createCampaignFn = new lambda.Function(this, 'CreateCampaignFn', {
			...commonLambdaProps,
			functionName: 'rpg-create-campaign',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const body = JSON.parse(event.body||'{}');
			    if(!body.name) return { statusCode: 400, body: JSON.stringify({ error: 'name required' }) };
			    const result = await withClient(async (db)=>{
			      const res = await db.query('INSERT INTO campaigns (name, description) VALUES ($1,$2) RETURNING id', [body.name, body.description||null]);
			      return res.rows[0];
			    });
			    return { statusCode: 201, headers:{'content-type':'application/json'}, body: JSON.stringify(result) };
			  };
			`),
		});
		dbSecret.grantRead(createCampaignFn);

		const listCampaignsFn = new lambda.Function(this, 'ListCampaignsFn', {
			...commonLambdaProps,
			functionName: 'rpg-list-campaigns',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async()=>{
			    const rows = await withClient(async (db)=>{
			      const res = await db.query('SELECT id, name, description, status FROM campaigns ORDER BY created_at DESC LIMIT 50');
			      return res.rows;
			    });
			    return { statusCode: 200, headers:{'content-type':'application/json'}, body: JSON.stringify({ items: rows }) };
			  };
			`),
		});
		dbSecret.grantRead(listCampaignsFn);

		const getCampaignFn = new lambda.Function(this, 'GetCampaignFn', {
			...commonLambdaProps,
			functionName: 'rpg-get-campaign',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const id = event.pathParameters?.id;
			    const row = await withClient(async (db)=>{
			      const res = await db.query('SELECT id, name, description, status FROM campaigns WHERE id = $1', [id]);
			      return res.rows[0]||null;
			    });
			    if(!row) return { statusCode: 404, body: JSON.stringify({ error: 'not found' }) };
			    return { statusCode: 200, headers:{'content-type':'application/json'}, body: JSON.stringify(row) };
			  };
			`),
		});
		dbSecret.grantRead(getCampaignFn);

		// Invite endpoint: publish to SQS (queue URL from SSM)
		const inviteFn = new lambda.Function(this, 'CreateInviteFn', {
			...commonLambdaProps,
			functionName: 'rpg-create-invite',
			handler: 'index.handler',
			environment: {
				...commonLambdaProps.environment,
				INVITE_QUEUE_URL: ssm.StringParameter.valueForStringParameter(this, '/rpg/mq/inviteQueueUrl'),
			},
			code: lambda.Code.fromInline(`
				exports.handler = async (event) => {
				  const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
				  const sqs = new SQSClient({});
				  const email = (JSON.parse(event.body || '{}').email)||'';
				  const campaignId = event.pathParameters?.id || 'unknown';
				  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
				  const messageBody = JSON.stringify({ email, campaignId, subject: 'Campaign Invite', message: 'You are invited' });
				  await sqs.send(new SendMessageCommand({ QueueUrl: process.env.INVITE_QUEUE_URL, MessageBody: messageBody }));
				  return { statusCode: 202, body: JSON.stringify({ ok: true }) };
				};
			`),
		});
		inviteFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['sqs:SendMessage'], resources: ['*'] }));
		dbSecret.grantRead(inviteFn);

		// Invite Accept endpoint: POST /v1/invites/{token}/accept (MVP: token is campaignId)
		const acceptInviteFn = new lambda.Function(this, 'AcceptInviteFn', {
			...commonLambdaProps,
			functionName: 'rpg-accept-invite',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const claims = (event.requestContext&&event.requestContext.authorizer&&event.requestContext.authorizer.claims)||{};
			    const sub = claims.sub||claims['cognito:username']||'unknown-sub';
			    const email = claims.email||'';
			    const token = event.pathParameters&&event.pathParameters.token; // MVP token = campaignId
			    if(!token) return { statusCode: 400, body: JSON.stringify({ error:'invalid token' }) };
			    const campaignId = token;
			    const username = email ? email.split('@')[0] : 'user';
			    const fallbackEmail = sub + '@example.com';
			    const userRow = await withClient(async(db)=>{
			      const ins = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (cognito_user_id) DO NOTHING RETURNING id', [email || fallbackEmail, username, sub]);
			      if(ins.rows[0]) return ins.rows[0];
			      const sel = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
			      return sel.rows[0];
			    });
			    if(!userRow) return { statusCode: 500, body: JSON.stringify({ error: 'user upsert failed' }) };
			    await withClient(async(db)=>{
			      await db.query('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [campaignId, userRow.id, 'player']);
			    });
			    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
			  };
			`),
		});
		dbSecret.grantRead(acceptInviteFn);

		// Sessions endpoints
		const createSessionFn = new lambda.Function(this, 'CreateSessionFn', {
			...commonLambdaProps,
			functionName: 'rpg-create-session',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const campaignId = event.pathParameters?.id;
			    const body = JSON.parse(event.body||'{}');
			    if(!body.title || !body.scheduled_at) return { statusCode:400, body: JSON.stringify({ error:'title and scheduled_at required'}) };
			    const row = await withClient(async(db)=>{
			      const res = await db.query('INSERT INTO sessions (campaign_id, title, scheduled_at, duration_minutes) VALUES ($1,$2,$3,$4) RETURNING id', [campaignId, body.title, body.scheduled_at, body.duration_minutes||180]);
			      return res.rows[0];
			    });
			    return { statusCode:201, headers:{'content-type':'application/json'}, body: JSON.stringify(row) };
			  };
			`),
		});
		dbSecret.grantRead(createSessionFn);

		const listSessionsFn = new lambda.Function(this, 'ListSessionsFn', {
			...commonLambdaProps,
			functionName: 'rpg-list-sessions',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const campaignId = event.pathParameters?.id;
			    const rows = await withClient(async(db)=>{
			      const res = await db.query('SELECT id, title, scheduled_at, duration_minutes, status FROM sessions WHERE campaign_id=$1 ORDER BY scheduled_at DESC LIMIT 100', [campaignId]);
			      return res.rows;
			    });
			    return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify({ items: rows }) };
			  };
			`),
		});
		dbSecret.grantRead(listSessionsFn);

		// Characters endpoints
		const getMyCharacterFn = new lambda.Function(this, 'GetMyCharacterFn', {
			...commonLambdaProps,
			functionName: 'rpg-get-my-character',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const claims = (event.requestContext&&event.requestContext.authorizer&&event.requestContext.authorizer.claims)||{};
			    const sub = claims.sub||claims['cognito:username'];
			    const campaignId = (event.queryStringParameters&&event.queryStringParameters.campaign_id)||null;
			    if(!campaignId) return { statusCode:400, body: JSON.stringify({ error:'campaign_id required'}) };
			    const row = await withClient(async(db)=>{
			      const u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
			      if(u.rows.length===0) return null;
			      const res = await db.query('SELECT id, name, class, level FROM characters WHERE campaign_id=$1 AND user_id=$2', [campaignId, u.rows[0].id]);
			      return res.rows[0]||null;
			    });
			    if(!row) return { statusCode:404, body: JSON.stringify({ error:'not found'}) };
			    return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify(row) };
			  };
			`),
		});
		dbSecret.grantRead(getMyCharacterFn);

		const putMyCharacterFn = new lambda.Function(this, 'PutMyCharacterFn', {
			...commonLambdaProps,
			functionName: 'rpg-put-my-character',
			handler: 'index.handler',
			code: lambda.Code.fromInline(`${pgHelper}
			  exports.handler = async(event)=>{
			    const claims = (event.requestContext&&event.requestContext.authorizer&&event.requestContext.authorizer.claims)||{};
			    const sub = claims.sub||claims['cognito:username'];
			    const body = JSON.parse(event.body||'{}');
			    const campaignId = (body.campaign_id)||null;
			    if(!campaignId || !body.name || !body.class) return { statusCode:400, body: JSON.stringify({ error:'campaign_id, name, class required'}) };
			    const result = await withClient(async(db)=>{
			      // ensure user exists
			      let u = await db.query('SELECT id FROM users WHERE cognito_user_id=$1', [sub]);
			      if(u.rows.length===0){
			        const ins = await db.query('INSERT INTO users (id, email, username, cognito_user_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', ['unknown@example.com','user', sub]);
			        u = { rows:[ins.rows[0]] };
			      }
			      const userId = u.rows[0].id;
			      const found = await db.query('SELECT id FROM characters WHERE campaign_id=$1 AND user_id=$2', [campaignId, userId]);
			      if(found.rows.length===0){
			        const ins = await db.query('INSERT INTO characters (campaign_id, user_id, name, class, level) VALUES ($1,$2,$3,$4,$5) RETURNING id', [campaignId, userId, body.name, body.class, body.level||1]);
			        return { id: ins.rows[0].id };
			      } else {
			        await db.query('UPDATE characters SET name=$3, class=$4, level=$5, updated_at=NOW() WHERE campaign_id=$1 AND user_id=$2', [campaignId, userId, body.name, body.class, body.level||1]);
			        return { id: found.rows[0].id };
			      }
			    });
			    return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify(result) };
			  };
			`),
		});
		dbSecret.grantRead(putMyCharacterFn);

		// Routes
		const campaigns = v1.addResource('campaigns');
		campaigns.addMethod('POST', new apigw.LambdaIntegration(createCampaignFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
		campaigns.addMethod('GET', new apigw.LambdaIntegration(listCampaignsFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
		const campaignById = campaigns.addResource('{id}');
		campaignById.addMethod('GET', new apigw.LambdaIntegration(getCampaignFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
		const invites = campaignById.addResource('invites');
		invites.addMethod('POST', new apigw.LambdaIntegration(inviteFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
			requestModels: { 'application/json': inviteModel },
			requestValidator: bodyValidator,
		});

		const invitesRoot = v1.addResource('invites');
		const tokenRes = invitesRoot.addResource('{token}');
		tokenRes.addResource('accept').addMethod('POST', new apigw.LambdaIntegration(acceptInviteFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});

		const sessionsRes = campaignById.addResource('sessions');
		sessionsRes.addMethod('POST', new apigw.LambdaIntegration(createSessionFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
		sessionsRes.addMethod('GET', new apigw.LambdaIntegration(listSessionsFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});

		const characters = v1.addResource('characters');
		characters.addResource('me').addMethod('GET', new apigw.LambdaIntegration(getMyCharacterFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
		characters.getResource('me')!.addMethod('PUT', new apigw.LambdaIntegration(putMyCharacterFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
	}
}
