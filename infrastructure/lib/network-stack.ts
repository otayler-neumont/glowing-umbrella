import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {}

export class NetworkStack extends cdk.Stack {
	public readonly vpc: ec2.Vpc;
	public readonly lambdaSecurityGroup: ec2.SecurityGroup;
	public readonly databaseSecurityGroup: ec2.SecurityGroup;
	public readonly endpointSecurityGroup: ec2.SecurityGroup;

	constructor(scope: Construct, id: string, props?: NetworkStackProps) {
		super(scope, id, props);

		this.vpc = new ec2.Vpc(this, 'AppVpc', {
			natGateways: 0,
			maxAzs: 2,
			subnetConfiguration: [
				{
					name: 'private-isolated',
					subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
				},
			],
		});

		this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
			vpc: this.vpc,
			allowAllOutbound: true,
			description: 'Security group for Lambda functions in VPC',
		});

		this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
			vpc: this.vpc,
			description: 'Security group for RDS instance',
			allowAllOutbound: false,
		});

		// Permit Lambda SG to connect to Postgres on RDS SG
		this.databaseSecurityGroup.addIngressRule(
			this.lambdaSecurityGroup,
			ec2.Port.tcp(5432),
			'Allow Lambda to connect to Postgres'
		);

		this.endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', {
			vpc: this.vpc,
			description: 'Security group for VPC Interface Endpoints',
			allowAllOutbound: true,
		});

		// Allow Lambdas to connect to the VPC endpoints
		this.endpointSecurityGroup.addIngressRule(
			this.lambdaSecurityGroup,
			ec2.Port.tcp(443),
			'Allow Lambda to reach interface endpoints over HTTPS'
		);

		// Interface VPC Endpoints for NAT-less access to core AWS services
		this.vpc.addInterfaceEndpoint('SsmEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.SSM,
			securityGroups: [this.endpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
		});
		this.vpc.addInterfaceEndpoint('KmsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.KMS,
			securityGroups: [this.endpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
		});
		this.vpc.addInterfaceEndpoint('SqsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.SQS,
			securityGroups: [this.endpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
		});
		this.vpc.addInterfaceEndpoint('SnsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.SNS,
			securityGroups: [this.endpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
		});
		this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
			securityGroups: [this.endpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
		});
	}
}
