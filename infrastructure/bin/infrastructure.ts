#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } as const;

const network = new NetworkStack(app, 'NetworkStack', { env });

new DatabaseStack(app, 'DatabaseStack', {
  env,
  vpc: network.vpc,
  databaseSecurityGroup: network.databaseSecurityGroup,
  parameterPrefix: '/rpg/db',
});

new AuthStack(app, 'AuthStack', {
  env,
  parameterPrefix: '/rpg/auth',
});

new ApiStack(app, 'ApiStack', {
  env,
  vpc: network.vpc,
  lambdaSecurityGroup: network.lambdaSecurityGroup,
  userPoolArnParamName: '/rpg/auth/userPoolArn',
});

new InfrastructureStack(app, 'InfrastructureStack', {
  env,
});