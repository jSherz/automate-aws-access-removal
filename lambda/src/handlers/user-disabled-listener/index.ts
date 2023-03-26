import { logger, tracer } from "../../shared/powertools";
import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer";
import { ExcludedUsersService } from "../../shared/excluded-users.service";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { IdentitystoreClient } from "@aws-sdk/client-identitystore";
import { buildHandler } from "./handler";
import { DirectoryService } from "../../shared/directory.service";

if (!process.env.TABLE_NAME) {
  throw new Error("You must set a TABLE_NAME!");
}

const dynamoDbClient = tracer.captureAWSv3Client(new DynamoDBClient({}));

const excludedUsersService = new ExcludedUsersService(
  dynamoDbClient,
  process.env.TABLE_NAME,
);

if (!process.env.IDENTITY_STORE_ID) {
  throw new Error("You must set an IDENTITY_STORE_ID!");
}

const identityStoreClient = tracer.captureAWSv3Client(
  new IdentitystoreClient({}),
);

const directoryService = new DirectoryService(
  identityStoreClient,
  process.env.IDENTITY_STORE_ID,
);

export const handler = middy(
  buildHandler(directoryService, excludedUsersService),
)
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));
