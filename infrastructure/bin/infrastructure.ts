#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { NetworkStack } from '../lib/network-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const network = new NetworkStack(app, 'NetworkStack', { env });

new InfrastructureStack(app, 'InfrastructureStack', {
  env,
});