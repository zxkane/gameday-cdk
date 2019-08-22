import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import { GamedayInfraCdkStack } from './gameday-infra-cdk-stack';
import ecs = require('@aws-cdk/aws-ecs');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import iam = require('@aws-cdk/aws-iam');
import ecr = require('@aws-cdk/aws-ecr');
import rds = require("@aws-cdk/aws-rds");
import s3 = require("@aws-cdk/aws-s3");
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');

interface ECSStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsSG: ec2.ISecurityGroup;
  albSG: ec2.ISecurityGroup;
  db: rds.IDatabaseCluster;
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

    // create S3 bucket for log
    const bucket = new s3.Bucket(this, 'GameLogBucket', {
      encryption: s3.BucketEncryption.KMS
    });

    // create container role and excutor role
    const executorRole = new iam.Role(this, 'GamedayExecutorRole', {
      roleName: 'GamedayECSExecutorRole',
      assumedBy: new iam.CompositePrincipal( 
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com')),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ]
    });

    const logPolicy = new iam.PolicyDocument();
    logPolicy.addStatements(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        '*'
      ]
    }));
    const containerRole = new iam.Role(this, 'GamedayContainerRole', {
      roleName: 'GamedayContainerRole',
      assumedBy: new iam.CompositePrincipal( 
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com')),
      inlinePolicies: {
        log: logPolicy
      }
    });

    bucket.grantPut(containerRole);

    // create a task definition with CloudWatch Logs
    const logging = new ecs.AwsLogDriver({
      streamPrefix: "gameday",
    })
    // create task definition of ECS
    const taskDef = new ecs.Ec2TaskDefinition(this, "GamedayTaskDefinition", {
      taskRole: containerRole,
      executionRole: executorRole,
      networkMode: ecs.NetworkMode.BRIDGE
    });
    
    const backendPort = 32769;
    const container = taskDef.addContainer("GamedayContainer", {
      image: ecs.ContainerImage.fromEcrRepository(ecr.Repository.fromRepositoryArn(this, 'Gameday',
        this.node.tryGetContext('ecrRepoARN')), this.node.tryGetContext('imageTag')),
      memoryLimitMiB: 1024,
      environment: {
        bucket: bucket.bucketName,
        endpoint: props.db.clusterEndpoint.socketAddress,
        dbname: 'gameday',
        username: '',
        password: ''
      },
      logging,
    });
    container.addPortMappings({
      containerPort: 80,
      hostPort: backendPort,
      protocol: ecs.Protocol.TCP
    }, {
      containerPort: 8080,
      hostPort: 8888,
      protocol: ecs.Protocol.TCP 
    });

    // Instantiate ECS Service with just cluster and image
    new ecs.Ec2Service(this, "GamedayService", {
      cluster,
      taskDefinition: taskDef
    });

    // Create the load balancer in a VPC. 'internetFacing' is 'false'
    // by default, which creates an internal load balancer.
    const alb = new elbv2.ApplicationLoadBalancer(this, 'GameALB', {
      vpc: props.vpc,
      internetFacing: true,
    });

    // Add a listener and open up the load balancer's security group
    // to the world. 'open' is the default, set this to 'false'
    // and use `listener.connections` if you want to be selective
    // about who can access the listener.
    const listener = alb.addListener('Http', {
      port: 80,
      open: true,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // Create an AutoScaling group and add it as a load balancing
    // target to the listener.
    listener.addTargets('GameContainers', {
      port: backendPort,
      protocol: elbv2.ApplicationProtocol.HTTP, 
      healthCheck: {

      },
      targets: [
        asg
      ]
    });

    
  }
}