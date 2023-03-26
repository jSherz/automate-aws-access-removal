import { injectLambdaContext } from "@aws-lambda-powertools/logger";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer";
import middy from "@middy/core";
import { logger, tracer } from "../../shared/powertools";
import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ExcludedUsersService } from "../../shared/excluded-users.service";
import { ScpService } from "../../shared/scp.service";
import { buildHandler } from "./handler";

if (!process.env.TABLE_NAME) {
  throw new Error("You must set a TABLE_NAME!");
}

if (!process.env.SCP_ID) {
  throw new Error("You must set an SCP_ID!");
}

if (!process.env.SCP_NAME) {
  throw new Error("You must set an SCP_NAME!");
}

if (!process.env.SCP_DESCRIPTION) {
  throw new Error("You must set an SCP_DESCRIPTION!");
}

const organizationsClient = tracer.captureAWSv3Client(
  new OrganizationsClient({}),
);

const scpService = new ScpService(
  organizationsClient,
  process.env.SCP_ID,
  process.env.SCP_NAME,
  process.env.SCP_DESCRIPTION,
);

const dynamoDbClient = tracer.captureAWSv3Client(new DynamoDBClient({}));

const excludedUsersService = new ExcludedUsersService(
  dynamoDbClient,
  process.env.TABLE_NAME,
);

export const handler = middy(buildHandler(excludedUsersService, scpService))
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));
