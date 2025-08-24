import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cognito as cognito, aws_ssm as ssm } from 'aws-cdk-lib';

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
				emailStyle: cognito.VerificationEmailStyle.LINK,
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

		new cognito.CfnUserPoolGroup(this, 'GmGroup', {
			groupName: 'gm',
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
	}
}
