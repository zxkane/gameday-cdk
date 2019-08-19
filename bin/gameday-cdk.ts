#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { GamedayCdkStack } from '../lib/gameday-cdk-stack';

const app = new cdk.App();
const gameStack = new GamedayCdkStack(app, 'GamedayCdkStack');

// Add a tag to all constructs in the stack
cdk.Tag.add(gameStack, 'usage', 'gameday');