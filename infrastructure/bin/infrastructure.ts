#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { MessagingStack } from '../lib/messaging-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

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

new MessagingStack(app, 'MessagingStack', {
  env,
  vpc: network.vpc,
  lambdaSecurityGroup: network.lambdaSecurityGroup,
  parameterPrefix: '/rpg/mq',
});

new ApiStack(app, 'ApiStack', {
  env,
  vpc: network.vpc,
  lambdaSecurityGroup: network.lambdaSecurityGroup,
  userPoolArnParamName: '/rpg/auth/userPoolArn',
});

new MonitoringStack(app, 'MonitoringStack', {
  env,
  // Set your email to receive alerts or leave undefined to skip email subscription.
  // alarmEmail: 'you@example.com',
  monthlyBudgetUSD: 50,
});

new InfrastructureStack(app, 'InfrastructureStack', {
  env,
});