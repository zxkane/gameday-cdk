import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import { SubnetType } from '@aws-cdk/aws-ec2'
import { SecurityGroup } from '@aws-cdk/aws-ec2'

export class GamedayCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // create a vpc in two AZs
    const vpc = new ec2.Vpc(this, 'Gameday', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [ 
        { 
          cidrMask: 24, 
          name: 'Public', 
          subnetType: SubnetType.PUBLIC
        }, 
        { 
          cidrMask: 24, 
          name: 'Private', 
          subnetType: SubnetType.PRIVATE
        }
      ]
    });

    // create SecurityGroup
    // SecurityGroup 0 for ELB allow 80 from anywhere
    const sg0 = new SecurityGroup(this, "SG0", {
      vpc,
      allowAllOutbound: true,
      description: "SG_for_gameday_ELB",
      securityGroupName: "SG0"
    });
    sg0.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Http port', false);
    // SecurityGroup 1 for request from ELB only to tcp port 32769
    const sg1 = new SecurityGroup(this, "SG1", {
      vpc,
      allowAllOutbound: true,
      description: "SG_for_backend_server",
      securityGroupName: "SG1" 
    });
    sg1.connections.allowFrom(new ec2.Connections({
      securityGroups: [sg0]
    }), ec2.Port.tcp(32769), 'Backend port');
    // SecurityGroup 2 for db from private subnets only
    const sg2 = new SecurityGroup(this, "SG2", {
      vpc,
      allowAllOutbound: true,
      description: "SG_for_database",
      securityGroupName: "SG2" 
    });
    sg2.connections.allowFrom(new ec2.Connections({
      securityGroups: [sg1]
    }), ec2.Port.tcp(3306), 'DB port');
    // SecurityGroup
    const sg3 = new SecurityGroup(this, "SG3", {
      vpc,
      allowAllOutbound: true,
      description: "SG_for_ssh",
      securityGroupName: "SG3" 
    });
    sg3.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'ssh port', true);
  }
}
