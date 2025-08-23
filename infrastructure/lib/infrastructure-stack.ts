import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda_nodejs as lambdaNode, aws_lambda as lambda, aws_ec2 as ec2, aws_ssm as ssm, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Optional migrate function - only created if DB params exist; otherwise this remains a no-op stack
    try {
      const dbSecretArn = ssm.StringParameter.valueForStringParameter(this, '/rpg/db/secretArn');
      const dbHost = ssm.StringParameter.valueForStringParameter(this, '/rpg/db/endpoint');

      // Import VPC and Lambda SG from NetworkStack exports if present
      const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
        vpcId: cdk.Fn.importValue('NetworkStack:ExportsOutputRefAppVpc9C086D4F2D8A2D5D'),
        availabilityZones: [cdk.Stack.of(this).availabilityZones[0], cdk.Stack.of(this).availabilityZones[1] || cdk.Stack.of(this).availabilityZones[0]],
        privateSubnetIds: [
          cdk.Fn.importValue('NetworkStack:ExportsOutputRefAppVpcprivateisolatedSubnet1Subnet39D72205E196C4E6'),
          cdk.Fn.importValue('NetworkStack:ExportsOutputRefAppVpcprivateisolatedSubnet2Subnet6F79A6837185DF17'),
        ],
      });
      const lambdaSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'ImportedLambdaSg', cdk.Fn.importValue('NetworkStack:ExportsOutputFnGetAttLambdaSecurityGroup0BD9FC99GroupId34A98CFB'));

      const migrateFn = new lambdaNode.NodejsFunction(this, 'MigrateFn', {
        entry: path.join(__dirname, '..', 'lambda-src', 'migrate.ts'),
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.minutes(2),
        bundling: { externalModules: [], minify: true, sourceMap: true },
        vpc,
        securityGroups: [lambdaSg],
        environment: {
          DB_SECRET_ARN: dbSecretArn,
          DB_HOST: dbHost,
          DB_NAME: 'appdb',
        },
      });

      secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecretForMigrate', dbSecretArn).grantRead(migrateFn);

      new cdk.CfnOutput(this, 'MigrateFunctionName', { value: migrateFn.functionName });
    } catch {
      // ignore if parameters not present yet
    }
  }
}
