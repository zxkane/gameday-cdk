import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import { GamedayInfraCdkStack } from './gameday-infra-cdk-stack';
import ecs = require('@aws-cdk/aws-ecs');

interface ECSStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class GamedayECSCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ECSStackProps) {
    super(scope, id, props);

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'GameDayCluster', {
      capacity: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE
        },
        desiredCapacity: 1
      },
      vpc: props.vpc
    });
  }
}