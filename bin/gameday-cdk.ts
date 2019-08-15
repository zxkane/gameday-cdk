#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { GamedayCdkStack } from '../lib/gameday-cdk-stack';

const app = new cdk.App();
new GamedayCdkStack(app, 'GamedayCdkStack');
