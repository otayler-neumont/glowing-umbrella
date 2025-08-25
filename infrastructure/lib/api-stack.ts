import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw, aws_lambda as lambda, aws_logs as logs, aws_ec2 as ec2, aws_ssm as ssm, aws_cognito as cognito, aws_iam as iam, aws_secretsmanager as secretsmanager, aws_lambda_nodejs as lambdaNode } from 'aws-cdk-lib';
import * as path from 'path';

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

		// Request models for validation
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

		const campaignModel = new apigw.Model(this, 'CampaignModel', {
			restApi: this.restApi,
			contentType: 'application/json',
			modelName: 'CampaignRequest',
			schema: {
				schema: apigw.JsonSchemaVersion.DRAFT4,
				title: 'CampaignRequest',
				type: apigw.JsonSchemaType.OBJECT,
				required: ['name'],
				properties: {
					name: { type: apigw.JsonSchemaType.STRING, minLength: 1, maxLength: 255 },
					description: { type: apigw.JsonSchemaType.STRING, maxLength: 1000 },
				},
			},
		});

		const sessionModel = new apigw.Model(this, 'SessionModel', {
			restApi: this.restApi,
			contentType: 'application/json',
			modelName: 'SessionRequest',
			schema: {
				schema: apigw.JsonSchemaVersion.DRAFT4,
				title: 'SessionRequest',
				type: apigw.JsonSchemaType.OBJECT,
				required: ['title', 'scheduled_at'],
				properties: {
					title: { type: apigw.JsonSchemaType.STRING, minLength: 1, maxLength: 255 },
					scheduled_at: { type: apigw.JsonSchemaType.STRING, format: 'date-time' },
					duration_minutes: { type: apigw.JsonSchemaType.INTEGER, minimum: 30, maximum: 480 },
					notes: { type: apigw.JsonSchemaType.STRING, maxLength: 1000 },
				},
			},
		});

		const characterModel = new apigw.Model(this, 'CharacterModel', {
			restApi: this.restApi,
			contentType: 'application/json',
			modelName: 'CharacterRequest',
			schema: {
				schema: apigw.JsonSchemaVersion.DRAFT4,
				title: 'CharacterRequest',
				type: apigw.JsonSchemaType.OBJECT,
				required: ['campaign_id', 'name', 'class'],
				properties: {
					campaign_id: { type: apigw.JsonSchemaType.STRING, format: 'uuid' },
					name: { type: apigw.JsonSchemaType.STRING, minLength: 1, maxLength: 255 },
					class: { type: apigw.JsonSchemaType.STRING, minLength: 1, maxLength: 100 },
					level: { type: apigw.JsonSchemaType.INTEGER, minimum: 1, maximum: 20 },
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
		const pingHandler = new lambdaNode.NodejsFunction(this, 'PingHandler', {
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'ping',
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 256,
			timeout: cdk.Duration.seconds(10),
			bundling: { externalModules: ['aws-sdk'], minify: true, sourceMap: true },
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: commonLambdaProps.environment,
		});
		dbSecret.grantRead(pingHandler);

		const v1 = this.restApi.root.addResource('v1');
		v1.addResource('ping').addMethod('GET', new apigw.LambdaIntegration(pingHandler));

		// Use bundled handlers from lambda-src/api.ts
		const nodeDefaults: Omit<lambdaNode.NodejsFunctionProps, 'entry' | 'handler' | 'functionName'> = {
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 256,
			timeout: cdk.Duration.seconds(10),
			bundling: { externalModules: ['aws-sdk'], minify: true, sourceMap: true },
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: commonLambdaProps.environment,
		};

		// Campaign CRUD (basic)
		const createCampaignFn = new lambdaNode.NodejsFunction(this, 'CreateCampaignFn', {
			...nodeDefaults,
			functionName: 'rpg-create-campaign',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'createCampaign',
		});
		dbSecret.grantRead(createCampaignFn);

		const listCampaignsFn = new lambdaNode.NodejsFunction(this, 'ListCampaignsFn', {
			...nodeDefaults,
			functionName: 'rpg-list-campaigns',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'listCampaigns',
		});
		dbSecret.grantRead(listCampaignsFn);

		const getCampaignFn = new lambdaNode.NodejsFunction(this, 'GetCampaignFn', {
			...nodeDefaults,
			functionName: 'rpg-get-campaign',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'getCampaign',
		});
		dbSecret.grantRead(getCampaignFn);

		// Invite endpoint: publish to SQS (queue URL from SSM)
		const inviteQueueArn = ssm.StringParameter.valueForStringParameter(this, '/rpg/mq/inviteQueueArn');
		const inviteFn = new lambdaNode.NodejsFunction(this, 'CreateInviteFn', {
			...nodeDefaults,
			functionName: 'rpg-create-invite',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'createInvite',
			environment: {
				...nodeDefaults.environment,
				INVITE_QUEUE_URL: ssm.StringParameter.valueForStringParameter(this, '/rpg/mq/inviteQueueUrl'),
				INVITE_QUEUE_ARN: inviteQueueArn,
			},
		});
		inviteFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['sqs:SendMessage'], resources: [inviteQueueArn] }));
		dbSecret.grantRead(inviteFn);

		// Invite Accept endpoint: POST /v1/invites/{token}/accept (validate token, join campaign)
		const acceptInviteFn = new lambdaNode.NodejsFunction(this, 'AcceptInviteFn', {
			...nodeDefaults,
			functionName: 'rpg-accept-invite',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'acceptInvite',
		});
		dbSecret.grantRead(acceptInviteFn);

		// Sessions endpoints
		const createSessionFn = new lambdaNode.NodejsFunction(this, 'CreateSessionFn', {
			...nodeDefaults,
			functionName: 'rpg-create-session',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'createSession',
		});
		dbSecret.grantRead(createSessionFn);

		const listSessionsFn = new lambdaNode.NodejsFunction(this, 'ListSessionsFn', {
			...nodeDefaults,
			functionName: 'rpg-list-sessions',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'listSessions',
		});
		dbSecret.grantRead(listSessionsFn);

		// Characters endpoints
		const getMyCharacterFn = new lambdaNode.NodejsFunction(this, 'GetMyCharacterFn', {
			...nodeDefaults,
			functionName: 'rpg-get-my-character',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'getMyCharacter',
		});
		dbSecret.grantRead(getMyCharacterFn);

		const putMyCharacterFn = new lambdaNode.NodejsFunction(this, 'PutMyCharacterFn', {
			...nodeDefaults,
			functionName: 'rpg-put-my-character',
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'api.ts'),
			handler: 'putMyCharacter',
		});
		dbSecret.grantRead(putMyCharacterFn);

		// Routes
		const campaigns = v1.addResource('campaigns');
		campaigns.addMethod('POST', new apigw.LambdaIntegration(createCampaignFn), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
			requestModels: { 'application/json': campaignModel },
			requestValidator: bodyValidator,
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
			requestModels: { 'application/json': sessionModel },
			requestValidator: bodyValidator,
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
			requestModels: { 'application/json': characterModel },
			requestValidator: bodyValidator,
		});
	}
}
