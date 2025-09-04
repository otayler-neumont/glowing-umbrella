import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cognito as cognito, aws_ssm as ssm, aws_lambda_nodejs as lambdaNode, aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';
import * as path from 'path';

export interface AuthStackProps extends cdk.StackProps {
	parameterPrefix?: string;
}

export class AuthStack extends cdk.Stack {
	public readonly userPool: cognito.UserPool;
	public readonly userPoolClient: cognito.UserPoolClient;

	constructor(scope: Construct, id: string, props?: AuthStackProps) {
		super(scope, id, props);

		const prefix = props?.parameterPrefix ?? '/rpg/auth';

		this.userPool = new cognito.UserPool(this, 'UserPool', {
			signInAliases: { email: true },
			selfSignUpEnabled: true,
			standardAttributes: {
				email: { required: true, mutable: false },
			},
			passwordPolicy: {
				minLength: 8,
				requireLowercase: true,
				requireUppercase: true,
				requireDigits: true,
				requireSymbols: false,
			},
			accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
			mfa: cognito.Mfa.OFF,
			userVerification: {
				emailStyle: cognito.VerificationEmailStyle.CODE,
				emailSubject: 'Your RPG Platform verification code',
				emailBody: 'Your verification code is {####}',
			},
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
			userPool: this.userPool,
			generateSecret: false,
			authFlows: {
				userSrp: true,
				userPassword: true,
			},
			preventUserExistenceErrors: true,
			accessTokenValidity: cdk.Duration.hours(1),
			idTokenValidity: cdk.Duration.hours(1),
			refreshTokenValidity: cdk.Duration.days(30),
		});

		// Hosted UI domain required for email link verification
		const domainPrefix = `rpg-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`.toLowerCase();
		this.userPool.addDomain('UserPoolDomain', {
			cognitoDomain: { domainPrefix },
		});

		new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
			groupName: 'admin',
			userPoolId: this.userPool.userPoolId,
		});
		new cognito.CfnUserPoolGroup(this, 'PlayerGroup', {
			groupName: 'player',
			userPoolId: this.userPool.userPoolId,
		});

		new ssm.StringParameter(this, 'UserPoolIdParam', {
			parameterName: `${prefix}/userPoolId`,
			stringValue: this.userPool.userPoolId,
			description: 'Cognito User Pool ID',
		});
		new ssm.StringParameter(this, 'UserPoolArnParam', {
			parameterName: `${prefix}/userPoolArn`,
			stringValue: this.userPool.userPoolArn,
			description: 'Cognito User Pool ARN',
		});
		new ssm.StringParameter(this, 'UserPoolClientIdParam', {
			parameterName: `${prefix}/userPoolClientId`,
			stringValue: this.userPoolClient.userPoolClientId,
			description: 'Cognito User Pool Client ID',
		});

		// Post-confirmation trigger to add new users to 'player' group by default
		const postConfirmFn = new lambdaNode.NodejsFunction(this, 'PostConfirmFn', {
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'post-confirm.ts'),
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 128,
			timeout: cdk.Duration.seconds(10),
			bundling: { externalModules: ['aws-sdk'], minify: true, sourceMap: true },
			environment: { DEFAULT_GROUP: 'player' },
		});
		// Use wildcard resource to avoid circular dependency between Lambda and UserPool trigger
		postConfirmFn.addToRolePolicy(new iam.PolicyStatement({
			actions: ['cognito-idp:AdminAddUserToGroup'],
			resources: ['*'],
		}));
		this.userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmFn);
	}
}
