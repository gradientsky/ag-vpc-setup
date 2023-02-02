# Creating SageMaker Notebook infrastructure in minutes

This project will help to quickly deploy infrastructure for development in SageMaker notbooks.

## Infrastructure Setup

For this exercise the following infrastructure setup will be used:
* VPC with public and private subnet with NAT + security group to control the access to the resources in the private subnets.
* VPC Endpoints to access S3 and necessary IAM roles
* Our SageMaker Notebook and inference endpoint will be running in the VPC mode and deployed to a private subnet
* KMS encryption is used on the notebook and endpoint
* This tutorial and other files required to run the notebook will be zipped and placed into account's S3 bucket.

For new accounts, we created a CDK infrastructure project available in [GitHub](https://github.com/gradientsky/ag-vpc-setup). To use it:
* clone [the project](https://github.com/gradientsky/ag-vpc-setup) locally
* Configure AWS credentials on the box this CLI will be running
* [Install CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
* One-time account setup for fresh accounts: `cdk bootsrap` - this will create artifacts for CDK

Using the script
* `cdk diff` will show the elements to be deployed to account
* `cdk deploy --parameters BootstrapArchive='s3://<bucket>/<prefix>/autogluon-tutorial.zip'` - deploy CDK stack and unzip archive into SageMaker workspace
* `cdk destroy` - destroy deployed CDK stack

# CDK

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful CDK commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
