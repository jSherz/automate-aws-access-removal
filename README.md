# automate-aws-access-removal

This is a solution to automate the blocking of AWS Identity Center user access
when they leave your workplace. See the [blog post on jSherz.com].

[blog post on jSherz.com]: https://jsherz.com/aws/service%20control%20policy/identity%20center/identity%20&%20access%20management/2023/04/08/automatically-blocking-users-after-they-leave.html

## Getting started

Install dependencies in the Lambda project:

```bash
cd lambdas

nvm use 18
corepack enable
yarn install
```

Head to the Terraform project and apply it all:

```bash
cd ../infrastructure

terraform init
terraform apply
```

Find your `identity_store_id` in the Identity Center console. It will start
with `d-`.
