import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as iam from '@aws-cdk/aws-iam';
import * as sagemaker from '@aws-cdk/aws-sagemaker';

export class AgVpcStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const key = new kms.Key(this, 'ag-kms-key', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            pendingWindow: cdk.Duration.days(7),
            enableKeyRotation: false,
        });

        const vpc = new ec2.Vpc(this, "Vpc", {
            maxAzs: 3,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'AgPrivate',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                },
                {
                    cidrMask: 24,
                    name: 'AgPublic',
                    subnetType: ec2.SubnetType.PUBLIC,
                }
            ]
        });

        vpc.addGatewayEndpoint('S3Endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3
        });

        const securityGroup = new ec2.SecurityGroup(this, 'AG-security-group', {
            vpc: vpc,
        })

        const notebookRole = new iam.Role(this, 'AG-notebookAccessRole', {
            assumedBy: new iam.ServicePrincipal('sagemaker'),
            managedPolicies: [
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ReadOnlyAccess')
            ]
        })

        const notebookPolicy = new iam.Policy(this, 'AG-notebookAccessPolicy', {
            policyName: 'notebookAccessPolicy',
            statements: [new iam.PolicyStatement({actions: ['s3:*'], resources: ['*']})]
        })

        const kmsKeyPolicy = new iam.Policy(this, 'AG-notebookAccessPolicy-kms', {
          policyName: 'notebookAccessPolicyKms',
          statements: [new iam.PolicyStatement({
            actions: [
              "kms:Encrypt",
              "kms:Decrypt",
              "kms:ReEncrypt*",
              "kms:GenerateDataKey*",
              "kms:DescribeKey",
              "kms:GetKeyPolicy",
              "kms:CreateGrant",
              "kms:ListGrants",
              "kms:RevokeGrant"],
            resources: [key.keyArn]
          })]
        })

        notebookPolicy.attachToRole(notebookRole)
        kmsKeyPolicy.attachToRole(notebookRole)

        const sagemakerNotebook = new sagemaker.CfnNotebookInstance(this, 'ML Notebook' , {
          instanceType: 'ml.m5.2xlarge',
          roleArn: notebookRole.roleArn,
          kmsKeyId: key.keyId,
          // defaultCodeRepository: repo.repositoryCloneUrlHttp,
          notebookInstanceName: "AutoGluonNotebook",
          directInternetAccess: "Disabled",
          subnetId: vpc.privateSubnets[0].subnetId,
          securityGroupIds: [securityGroup.securityGroupId],
          volumeSizeInGb: 20
        });

        new cdk.CfnOutput(this, 'AGKmsKeyId', {value: key.keyArn});
        new cdk.CfnOutput(this, 'AGSubnets', {
            value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(",")
        });
        new cdk.CfnOutput(this, 'AGSecurityGroup', {value: securityGroup.securityGroupId});
    }
}
