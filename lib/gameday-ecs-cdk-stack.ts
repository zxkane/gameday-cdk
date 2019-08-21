import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import { GamedayInfraCdkStack } from './gameday-infra-cdk-stack';
import ecs = require('@aws-cdk/aws-ecs');
import autoscaling = require('@aws-cdk/aws-autoscaling');

interface ECSStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsSG: ec2.ISecurityGroup;
}

export class GamedayECSCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ECSStackProps) {
    super(scope, id, props);

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'GameDayCluster', {
      vpc: props.vpc
    });

    // create auto scaling group
    const asg = new autoscaling.AutoScalingGroup(this, 'GamedayASG', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: new ecs.EcsOptimizedAmi(),
      updateType: autoscaling.UpdateType.REPLACING_UPDATE,
      desiredCapacity: 1,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE
      }
    });
    asg.addSecurityGroup(props.ecsSG);

    cluster.addAutoScalingGroup(asg);
  }
}