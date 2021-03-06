import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import { SubnetType } from '@aws-cdk/aws-ec2'
import { SecurityGroup } from '@aws-cdk/aws-ec2'
import rds = require("@aws-cdk/aws-rds");
import { RetentionDays } from '@aws-cdk/aws-logs'

export class GamedayInfraCdkStack extends cdk.Stack {
  
  readonly vpc: ec2.IVpc;
  readonly ecsSG: ec2.ISecurityGroup;
  readonly albSG: ec2.ISecurityGroup;
  readonly dbEndpoint: string;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // create a vpc in two AZs
    this.vpc = new ec2.Vpc(this, 'Gameday', {
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
    const sg0 = this.albSG = new SecurityGroup(this, "SG0", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "SG_for_gameday_ELB",
      securityGroupName: "SG0"
    });
    sg0.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Http port', false);
    // SecurityGroup 1 for request from ELB only to tcp port 32769
    const sg1 = this.ecsSG = new SecurityGroup(this, "SG1", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "SG_for_backend_server",
      securityGroupName: "SG1" 
    });
    sg1.connections.allowFrom(new ec2.Connections({
      securityGroups: [sg0]
    }), ec2.Port.tcp(32769), 'Backend port');
    // SecurityGroup 2 for db from private subnets only
    const sg2 = new SecurityGroup(this, "SG2", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "SG_for_database",
      securityGroupName: "SG2" 
    });
    sg2.connections.allowFrom(new ec2.Connections({
      securityGroups: [sg1]
    }), ec2.Port.tcp(3306), 'DB port');
    // SecurityGroup
    const sg3 = new SecurityGroup(this, "SG3", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "SG_for_ssh",
      securityGroupName: "SG3" 
    });
    sg3.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'ssh port', true);

    // create Aurora cluster
    const masterUser = 'admin';
    const ec2InstanceType = ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL);
    
    const dbclsterpar = new rds.CfnDBClusterParameterGroup(this, 'GameAuroraPG', {
      description: 'parameter group of gameday rds cluster',
      family: 'aurora-mysql5.7',
      parameters: {
        server_audit_logging: '1',
        server_audit_events: 'QUERY_DML',
        server_audit_logs_upload: '1',
        server_audit_incl_users: [masterUser].join(',')
      },
    });

    const rdssubnet = new rds.CfnDBSubnetGroup(this, 'GameAuroraSubnetGroup', {
      dbSubnetGroupDescription: 'subnet group of game rds cluster',
      subnetIds: this.vpc.privateSubnets.map(function(subnet) {
        return subnet.subnetId;
      }),
    });

    let secret = new rds.DatabaseSecret(this, 'Secret', {
      username: masterUser,
    });

    const dbcluster = new rds.CfnDBCluster(this, 'GameCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL.name,
      availabilityZones: this.vpc.availabilityZones,
      databaseName: 'gameday',
      dbClusterParameterGroupName: dbclsterpar.ref,
      dbSubnetGroupName: rdssubnet.ref,
      masterUsername: masterUser, 
      masterUserPassword: secret.secretValueFromJson('password').toString(),
      port: 3306,
      vpcSecurityGroupIds: [
        sg2.securityGroupId
      ],
      enableCloudwatchLogsExports: [
        'audit'
      ],
    });
    dbcluster.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY, {
      applyToUpdateReplacePolicy: true
    });

    const instanceCount = 1;
    for (let i = 0; i < instanceCount; i++) {
      const instanceIdentifier = 'GameInstance' + (i + 1);
      const instance = new rds.CfnDBInstance(this, instanceIdentifier, {
        engine: dbcluster.engine,
        dbClusterIdentifier: dbcluster.ref,
        dbInstanceIdentifier: instanceIdentifier,
        dbInstanceClass: 'db.' + ec2InstanceType.toString(),    //'db.t2.small',
        dbSubnetGroupName: rdssubnet.ref,
        publiclyAccessible: false
      });
      instance.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY, {
        applyToUpdateReplacePolicy: true
      });
    };

    this.dbEndpoint = `${dbcluster.attrEndpointAddress}:${dbcluster.attrEndpointPort}`;
  }
}
