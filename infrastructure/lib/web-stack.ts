import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { aws_ssm as ssm, aws_iam as iam } from 'aws-cdk-lib';

export interface WebStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
  githubTokenSecretName: string; // Name in Secrets Manager that holds a GitHub token with repo access
  branchName?: string; // default: main
}

export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const branchName = props.branchName ?? 'main';

    // Create explicit Amplify service role with proper path and permissions
    const amplifyServiceRole = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      path: '/service-role/',
      description: 'Amplify Hosting service role for building/deploying Next.js app',
    });
    amplifyServiceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'));

    const app = new amplify.App(this, 'NextJsAmplifyApp', {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: props.githubOwner,
        repository: props.githubRepo,
        oauthToken: cdk.SecretValue.secretsManager(props.githubTokenSecretName),
      }),
      role: amplifyServiceRole,
      // Build will be driven by repo's amplify.yml (monorepo appRoot: web)
    });

    const branch = app.addBranch(branchName);

    // Environment variables for Next.js build/runtime (NEXT_PUBLIC_*). Read from existing SSM/Exports.
    const userPoolId = ssm.StringParameter.valueForStringParameter(this, '/rpg/auth/userPoolId');
    const userPoolClientId = ssm.StringParameter.valueForStringParameter(this, '/rpg/auth/userPoolClientId');
    const region = cdk.Stack.of(this).region;
    const apiBase = cdk.Fn.importValue('ApiStack-ApiGatewayUrl');

    branch.addEnvironment('NEXT_PUBLIC_COGNITO_USER_POOL_ID', userPoolId);
    branch.addEnvironment('NEXT_PUBLIC_COGNITO_CLIENT_ID', userPoolClientId);
    branch.addEnvironment('NEXT_PUBLIC_REGION', region);
    branch.addEnvironment('NEXT_PUBLIC_API_BASE', apiBase);

    new cdk.CfnOutput(this, 'AmplifyAppId', { value: app.appId });
    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', { value: app.defaultDomain });
    new cdk.CfnOutput(this, 'AmplifyBranchName', { value: branch.branchName });
  }
}


