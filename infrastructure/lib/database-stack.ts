import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_rds as rds, aws_secretsmanager as secretsmanager, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
	vpc: ec2.IVpc;
	databaseSecurityGroup: ec2.ISecurityGroup;
	parameterPrefix?: string;
}

export class DatabaseStack extends cdk.Stack {
	public readonly dbInstance: rds.DatabaseInstance;
	public readonly secret: secretsmanager.ISecret;

	constructor(scope: Construct, id: string, props: DatabaseStackProps) {
		super(scope, id, props);

		const parameterPrefix = props.parameterPrefix ?? '/app/database';

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

		new ssm.StringParameter(this, 'DbSecretArnParam', {
			parameterName: `${parameterPrefix}/secretArn`,
			stringValue: this.secret.secretArn,
			description: 'Secrets Manager ARN for the RDS credentials',
		});

		new ssm.StringParameter(this, 'DbEndpointParam', {
			parameterName: `${parameterPrefix}/endpoint`,
			stringValue: this.dbInstance.instanceEndpoint.hostname,
			description: 'RDS endpoint hostname',
		});
	}
}
