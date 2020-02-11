#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkVpcStack } from '../lib/cdk-vpc-stack';
import {  RDSStack } from "../lib/rds-stack";

const app = new cdk.App();
const vpcStackEntity = new CdkVpcStack(app, 'CdkVpcStack');

// new RDSStack(app, 'RDSStack', {
//     vpc: vpcStackEntity.vpc
// });

app.synth();

