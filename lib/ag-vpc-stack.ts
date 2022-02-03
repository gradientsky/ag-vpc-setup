import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';

export class AgVpcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const key = new kms.Key(this, 'ag-kms-key', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(7),
      alias: 'alias/agkey',
      description: 'KMS key for encrypting the objects in an S3 bucket',
      enableKeyRotation: false,
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ag-private-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        {
          cidrMask: 24,
          name: 'ag-public-1',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });

    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3
    });

    const securityGroup = new ec2.SecurityGroup(this, 'LaunchTemplateSG', {
      vpc: vpc,
    })

    new cdk.CfnOutput(this, 'AGKmsKeyId', { value: key.keyArn });
    new cdk.CfnOutput(this, 'AGSubnets', { value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(",")

  });
    


  }
}
