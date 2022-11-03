import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';

export class AgVpcStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const bootstrapArchive = new cdk.CfnParameter(this, "BootstrapArchive", {
            type: "String",
            description: "Archive in S3 to download and extract to SageMaker directory."
        });

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
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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

        const notebookLifecycleConfig = new sagemaker.CfnNotebookInstanceLifecycleConfig(this, 'NotebookLifecycleConfig', {
            notebookInstanceLifecycleConfigName: 'AgNotebookLifecycleConfig',
            onCreate: [
                {
                    content: cdk.Fn.base64(
                        `
#!/bin/bash
set -e
if [ ! -d /home/ec2-user/ag_bootstrapped ]; then
mkdir -p /home/ec2-user/SageMaker/
echo 'AG_SECURITY_GROUP=${securityGroup.securityGroupId}' > /home/ec2-user/SageMaker/ag.props
echo 'AG_SUBNETS=${vpc.privateSubnets.map(subnet => subnet.subnetId).join(",")}' >> /home/ec2-user/SageMaker/ag.props
echo 'AG_KMS_KEY=${key.keyArn}' >> /home/ec2-user/SageMaker/ag.props

mkdir ag-tmp
cd ag-tmp
aws s3 cp ${bootstrapArchive.valueAsString} bootstrap.zip
unzip bootstrap.zip -d /home/ec2-user/SageMaker/
chown ec2-user:ec2-user -R /home/ec2-user/SageMaker/
cd ..
rm -rf ag-tmp
sudo touch /home/ec2-user/ag_bootstrapped
fi
`
                    ),
                }
            ]

        });


        const sagemakerNotebook = new sagemaker.CfnNotebookInstance(this, 'ML Notebook', {
            instanceType: 'ml.m5.4xlarge',
            roleArn: notebookRole.roleArn,
            kmsKeyId: key.keyId,
            // defaultCodeRepository: repo.repositoryCloneUrlHttp,
            notebookInstanceName: "AutoGluonNotebook",
            platformIdentifier: "notebook-al2-v2",
            directInternetAccess: "Disabled",
            subnetId: vpc.privateSubnets[0].subnetId,
            securityGroupIds: [securityGroup.securityGroupId],
            volumeSizeInGb: 20,
            lifecycleConfigName: notebookLifecycleConfig.attrNotebookInstanceLifecycleConfigName

        });

        new cdk.CfnOutput(this, 'AGKmsKeyId', {value: key.keyArn});
        new cdk.CfnOutput(this, 'AGSubnets', {
            value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(",")
        });
        new cdk.CfnOutput(this, 'AGSecurityGroup', {value: securityGroup.securityGroupId});
    }
}
