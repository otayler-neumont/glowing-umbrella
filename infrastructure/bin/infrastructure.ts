#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } as const;

const network = new NetworkStack(app, 'NetworkStack', { env });

new DatabaseStack(app, 'DatabaseStack', {
  env,
  vpc: network.vpc,
  databaseSecurityGroup: network.databaseSecurityGroup,
  parameterPrefix: '/rpg/db',
});

new InfrastructureStack(app, 'InfrastructureStack', {
  env,
});