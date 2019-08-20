#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { GamedayInfraCdkStack } from '../lib/gameday-infra-cdk-stack';
import { GamedayECSCdkStack } from '../lib/gameday-ecs-cdk-stack';

const app = new cdk.App();
const gameStack = new GamedayInfraCdkStack(app, 'GamedayInfraCdkStack');
const gameECSStack = new GamedayECSCdkStack(app, 'GamedayECSCdkStack');

// Add a tag to all constructs in the stack
cdk.Tag.add(gameStack, 'usage', 'gameday');
cdk.Tag.add(gameECSStack, 'usage', 'gameday');