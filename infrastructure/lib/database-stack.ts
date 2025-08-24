import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_rds as rds, aws_secretsmanager as secretsmanager, aws_ssm as ssm, aws_lambda_nodejs as lambdaNode, aws_lambda as lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export interface DatabaseStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	databaseSecurityGroup: ec2.ISecurityGroup;
	lambdaSecurityGroup: ec2.ISecurityGroup;
	parameterPrefix?: string;
}

export class DatabaseStack extends cdk.Stack {
	public readonly dbInstance: rds.DatabaseInstance;
	public readonly secret: secretsmanager.ISecret;

	constructor(scope: Construct, id: string, props: DatabaseStackProps) {
		super(scope, id, props);

		const parameterPrefix = props.parameterPrefix ?? '/rpg/db';

		const dbCredentials = rds.Credentials.fromGeneratedSecret('app_user');

		const parameterGroup = new rds.ParameterGroup(this, 'PostgresParams', {
			engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
			parameters: {
				'rds.force_ssl': '1',
			},
		});

		this.dbInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
			engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
			vpc: props.vpc,
			vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
			securityGroups: [props.databaseSecurityGroup],
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			multiAz: false,
			allocatedStorage: 20,
			maxAllocatedStorage: 100,
			credentials: dbCredentials,
			parameterGroup,
			publiclyAccessible: false,
			storageEncrypted: true,
			backupRetention: cdk.Duration.days(1),
			deleteAutomatedBackups: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			deletionProtection: false,
			databaseName: 'appdb',
		});

		this.secret = this.dbInstance.secret!;

		const secretArnParam = new ssm.StringParameter(this, 'DbSecretArnParam', {
			parameterName: `${parameterPrefix}/secretArn`,
			stringValue: this.secret.secretArn,
			description: 'Secrets Manager ARN for the RDS credentials',
		});

		const endpointParam = new ssm.StringParameter(this, 'DbEndpointParam', {
			parameterName: `${parameterPrefix}/endpoint`,
			stringValue: this.dbInstance.instanceEndpoint.hostname,
			description: 'RDS endpoint hostname',
		});

		// Optional migrate function that runs the embedded SQL (invoke manually once after deploy)
		const migrateFn = new lambdaNode.NodejsFunction(this, 'MigrateFn', {
			entry: path.join(__dirname, '..', '..', 'lambda-src', 'migrate.ts'),
			runtime: lambda.Runtime.NODEJS_20_X,
			memorySize: 512,
			timeout: cdk.Duration.minutes(2),
			bundling: { externalModules: [], minify: true, sourceMap: true },
			vpc: props.vpc,
			securityGroups: [props.lambdaSecurityGroup],
			environment: {
				DB_SECRET_ARN: secretArnParam.stringValue,
				DB_HOST: endpointParam.stringValue,
				DB_NAME: 'appdb',
			},
		});
		this.secret.grantRead(migrateFn);

		new cdk.CfnOutput(this, 'MigrateFunctionName', { value: migrateFn.functionName });
	}
}
