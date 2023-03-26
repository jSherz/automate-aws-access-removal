import {
  OrganizationsClient,
  UpdatePolicyCommand,
} from "@aws-sdk/client-organizations";
import { logger } from "./powertools";

export interface IScpService {
  updatePolicy(excludedUsers: string[]): Promise<string>;
}

export class ScpService implements IScpService {
  constructor(
    private readonly organizationsClient: OrganizationsClient,
    private readonly id: string,
    private readonly name: string,
    private readonly description: string,
  ) {}

  async updatePolicy(excludedUsers: string[]): Promise<string> {
    const contents = JSON.stringify(
      {
        Version: "2012-10-17",
        Statement: [
          // See https://aws.amazon.com/blogs/security/how-to-revoke-federated-users-active-aws-sessions/
          {
            Effect: "Deny",
            Action: "*",
            Resource: "*",
            Condition: {
              StringLike: {
                "aws:userid": excludedUsers.map(
                  excludedUser => `*:${excludedUser}`,
                ),
              },
            },
          },
          {
            Effect: "Deny",
            Action: "*",
            Resource: "*",
            Condition: {
              StringEquals: {
                "aws:SourceIdentity": excludedUsers,
              },
            },
          },
        ],
      },
      null,
      2,
    );

    try {
      const updateResult = await this.organizationsClient.send(
        new UpdatePolicyCommand({
          PolicyId: this.id,
          Name: this.name,
          Description: this.description,
          Content: contents,
        }),
      );

      // This is always set
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return updateResult.Policy!.Content!;
    } catch (err) {
      logger.error("failed to update SCP", { err, policyContents: contents });

      throw err;
    }
  }
}
