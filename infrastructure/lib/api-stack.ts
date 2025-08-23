import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw, aws_lambda as lambda, aws_logs as logs, aws_ec2 as ec2, aws_ssm as ssm, aws_cognito as cognito, aws_iam as iam } from 'aws-cdk-lib';

export interface ApiStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	lambdaSecurityGroup: ec2.ISecurityGroup;
	userPoolArnParamName: string; // e.g., /rpg/auth/userPoolArn
}

export class ApiStack extends cdk.Stack {
	public readonly restApi: apigw.RestApi;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

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

		// Common function settings for API handlers
		const commonLambdaProps: Omit<lambda.FunctionProps, 'code' | 'handler' | 'functionName'> = {
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 256,
			timeout: cdk.Duration.seconds(10),
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: {
				NODE_OPTIONS: '--enable-source-maps',
			},
		};

		// Public health check endpoint (optional)
		const pingHandler = new lambda.Function(this, 'PingHandler', {
			...commonLambdaProps,
			functionName: 'rpg-ping',
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async()=>({statusCode:200,headers:{"content-type":"application/json"},body:JSON.stringify({ok:true,message:"pong"})});'),
		});

		const v1 = this.restApi.root.addResource('v1');
		v1.addResource('ping').addMethod('GET', new apigw.LambdaIntegration(pingHandler));

		// Campaign endpoints (stub handlers for now)
		const createCampaignFn = new lambda.Function(this, 'CreateCampaignFn', {
			...commonLambdaProps,
			functionName: 'rpg-create-campaign',
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async(event)=>({statusCode:201,headers:{"content-type":"application/json"},body:JSON.stringify({id:"demo-id",input:JSON.parse(event.body||"{}")})});'),
		});

		const listCampaignsFn = new lambda.Function(this, 'ListCampaignsFn', {
			...commonLambdaProps,
			functionName: 'rpg-list-campaigns',
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async()=>({statusCode:200,headers:{"content-type":"application/json"},body:JSON.stringify({items:[]})});'),
		});

		const getCampaignFn = new lambda.Function(this, 'GetCampaignFn', {
			...commonLambdaProps,
			functionName: 'rpg-get-campaign',
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async(event)=>({statusCode:200,headers:{"content-type":"application/json"},body:JSON.stringify({id:event.pathParameters?.id||"unknown"})});'),
		});

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
				  const AWS = require('aws-sdk');
				  const sqs = new AWS.SQS();
				  const email = (JSON.parse(event.body || '{}').email)||'';
				  const campaignId = event.pathParameters?.id || 'unknown';
				  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
				  const messageBody = JSON.stringify({ email, campaignId, subject: 'Campaign Invite', message: 'You are invited' });
				  await sqs.sendMessage({ QueueUrl: process.env.INVITE_QUEUE_URL, MessageBody: messageBody }).promise();
				  return { statusCode: 202, body: JSON.stringify({ ok: true }) };
				};
			`),
		});
		inviteFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['sqs:SendMessage'], resources: ['*'] }));

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
		});
	}
}
