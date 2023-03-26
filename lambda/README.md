# automate-aws-access-removal

## Lambda

### Development

**NB:** the tests create and delete DynamoDB tables. They take roughly a minute
to run against AWS, or a few seconds to run against DynamoDB local.

```bash
# Switch to Node 18 and enable corepack if not already done
nvm use 18
corepack enable

# Install dependencies
yarn install

# Setup AWS credentials
export AWS_PROFILE=...
aws sso login

# Run the tests
yarn test
```

You can also use [DynamoDB local]:

[DynamoDB local]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

```bash
docker-compose up -d

export DYNAMODB_ENDPOINT=http://localhost:8000
yarn test
```
