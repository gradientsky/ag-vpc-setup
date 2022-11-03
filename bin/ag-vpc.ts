#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AgVpcStack } from '../lib/ag-vpc-stack';

const env_west = { region: 'us-west-2' };
const env_east = { region: 'us-east-1' };
const app = new cdk.App();
new AgVpcStack(app, 'AgVpcStack-west', { env: env_west });
// new AgVpcStack(app, 'AgVpcStack-east', { env: env_east });