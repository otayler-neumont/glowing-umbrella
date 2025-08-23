import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigw, aws_lambda as lambda, aws_logs as logs, aws_ec2 as ec2, aws_ssm as ssm, aws_cognito as cognito } from 'aws-cdk-lib';

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

		// Placeholder Lambda to prove wiring; real handlers will be added later
		const commonLambdaProps: Omit<lambda.FunctionProps, 'code' | 'handler'> = {
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 256,
			timeout: cdk.Duration.seconds(10),
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
		};

		const pingHandler = new lambda.Function(this, 'PingHandler', {
			...commonLambdaProps,
			handler: 'index.handler',
			code: lambda.Code.fromInline('exports.handler=async()=>({statusCode:200,body:\"pong\"});'),
		});

		const v1 = this.restApi.root.addResource('v1');
		const ping = v1.addResource('ping');
		ping.addMethod('GET', new apigw.LambdaIntegration(pingHandler), {
			authorizer,
			authorizationType: apigw.AuthorizationType.COGNITO,
		});
	}
}
