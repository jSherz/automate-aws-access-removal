# automate-aws-access-removal

This is a solution to automate the blocking of AWS Identity Center user access
when they leave your workplace. See the [blog post on jSherz.com].

[blog post on jSherz.com]: https://jsherz.com/aws/service%20control%20policy/identity%20center/identity%20&%20access%20management/2023/04/08/automatically-blocking-users-after-they-leave.html

## Getting started

This project requires an S3 bucket to store Lambda packages. This must be
created before the Terraform portion can be fully applied:

```bash
# Configure AWS credentials however you like
export AWS_PROFILE=...
aws sso login

cd infrastructure

# Optional: create a <name>.auto.tfvars file with the identity_store_id

# Optional: setup Terraform remote state if you have a source to hand

# Create the Lambda S3 bucket
terraform init
terraform apply \
    -target module.lambda_packages_bucket \
    -var identity_store_id=unused \
    -var lambdas={}
```

With the bucket created, package the Lambda functions:

```bash
cd ../lambdas

nvm use 18
corepack enable
yarn install

./scripts/package.sh <account ID> <region>
```

Return to the Terraform project and apply it all:

```bash
cd ../infrastructure

terraform apply
```

Find your `identity_store_id` in the Identity Center console. It will start
with `d-`.
