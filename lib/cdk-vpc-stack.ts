import { App, Stack, StackProps, Construct, Resource, Fn, Tag } from '@aws-cdk/core';
import {
  Vpc,
  UserData,
  ISubnet,
  SecurityGroup,
  InstanceType,
  SubnetType,
  CfnInstanceProps,
  IMachineImage,
  CfnInstance,
  AmazonLinuxImage,
  InstanceClass,
  InstanceSize,
  Peer,
  Port,
} from '@aws-cdk/aws-ec2'

import { CfnInstanceProfile, Role, ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';

interface Ec2InstanceProps extends StackProps {
  image: IMachineImage;
  instanceType: InstanceType;
  userData: UserData;
  subnet: ISubnet;
  role: Role;
}

class EC2 extends Resource {
  constructor(scope: Construct, id: string, props?: Ec2InstanceProps) {
    super(scope, id);
    
    if (props) {
      // create a profile to attache the role to the instance
      const profile = new CfnInstanceProfile(this, `${id}Profile`, {
          roles: [props.role.roleName]
      });

      // create the instance
      const instance = new CfnInstance(this, id, {
        imageId: props.image.getImage(this).imageId,
        instanceType: props.instanceType.toString(), 
        networkInterfaces: [
            {
              deviceIndex: "0",
              subnetId: props.subnet.subnetId
            }
        ],
        userData: Fn.base64(props.userData.render()),
        iamInstanceProfile: profile.ref
      });

      // tag the instance
      Tag.add(instance, 'Name', `${CdkVpcStack.name}/${id}`);
    }
  } 
}

export class CdkVpcStack extends Stack {
  
  readonly vpc: Vpc;
  readonly ingressSecurityGroup: SecurityGroup;
  readonly egressSecurityGroup: SecurityGroup;
  
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create VPC with public and private subnet in two AZ,
    this.vpc = new Vpc(this, 'Dev-Vpc', {
      cidr: '192.168.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [{
        cidrMask: 26,
        name: 'public-subnet',
        subnetType: SubnetType.PUBLIC
      },{
        cidrMask: 26,
        name: 'isolated-subnet',
        subnetType: SubnetType.ISOLATED
      }],
      natGateways: 0
    });

    // Create the security group 
    // Configuring the ingress traffic (IN) to allow traffic to port 80 from any IP
    // and allow also all traffic from my IP

    this.ingressSecurityGroup = new SecurityGroup(this, 'ingress-security-group', {
        vpc: this.vpc,
        allowAllOutbound: false,
        securityGroupName: 'IngressSecurityGroup',
    });
    this.ingressSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    this.ingressSecurityGroup.addIngressRule(Peer.ipv4('41.251.117.105/32'), Port.allTraffic());

    // Configuring the egress traffic (OUT) 
    this.egressSecurityGroup = new SecurityGroup(this, 'egress-security-group', {
        vpc: this.vpc,
        allowAllOutbound: true,
        securityGroupName: 'EgressSecurityGroup',
    });
    this.egressSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.allTraffic());

    this.ingressSecurityGroup.uniqueId
    // define the IAM role that will allow the instance to communicate with SSM
    const role = new Role(this, 'SSMRole-assumedBy-EC2', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com')
    });

    // Attach managed policy to the role created above
    // the policy ARN arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // define a userData script to install & launch our web server
    // making sure the latest SSM agent is installed.
    // install and start Nginx
    const instanceUserData = UserData.forLinux();
    const SSM_AGENT_RPM = 'https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm';
    instanceUserData.addCommands(`sudo yum install -y ${SSM_AGENT_RPM}`, 'restart amazon-ssm-agent');
    instanceUserData.addCommands('yum install -y nginx', 'chkconfig nginx on', 'service nginx start');   

    // launch the instance in the public Subnet
    const publicSubnet0 = this.vpc.publicSubnets[0];
    const securityGroupIds = [this.ingressSecurityGroup.securityGroupId, this.egressSecurityGroup.securityGroupId]
    const instance = new EC2(this, 'NewsBlogInstance', {
      image: new AmazonLinuxImage(),
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      subnet: publicSubnet0,
      role,
      userData: instanceUserData
    })

    console.log(this.ingressSecurityGroup.securityGroupId)
 
  }
}
