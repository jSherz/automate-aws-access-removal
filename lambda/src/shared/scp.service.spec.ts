import {
  OrganizationsClient,
  UpdatePolicyCommand,
} from "@aws-sdk/client-organizations";
import { mockClient } from "aws-sdk-client-mock";
import { ScpService } from "./scp.service";
import "aws-sdk-client-mock-jest";

describe("ScpService", () => {
  describe("updatePolicy", () => {
    it("forms the SCP and applies it", async () => {
      const organizationsClient = new OrganizationsClient({});

      /**
       * NB: do not call mockClient on the class OrganizationsClient - use an
       * instance to avoid polluting other calls.
       */
      const clientMock = mockClient(organizationsClient);

      const service = new ScpService(
        organizationsClient,
        "policy-123",
        "my-policy",
        "Some description.",
      );

      clientMock.on(UpdatePolicyCommand).resolvesOnce({
        Policy: {
          Content: "the final policy",
        },
      });

      await expect(
        service.updatePolicy(["user1@jsherz.com", "user2@jsherz.com"]),
      ).resolves.toEqual("the final policy");

      expect(clientMock).toHaveReceivedCommandWith(UpdatePolicyCommand, {
        PolicyId: "policy-123",
        Name: "my-policy",
        Description: "Some description.",
        Content: JSON.stringify(
          {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Deny",
                Action: "*",
                Resource: "*",
                Condition: {
                  StringLike: {
                    "aws:userid": ["*:user1@jsherz.com", "*:user2@jsherz.com"],
                  },
                },
              },
              {
                Effect: "Deny",
                Action: "*",
                Resource: "*",
                Condition: {
                  StringEquals: {
                    "aws:SourceIdentity": [
                      "user1@jsherz.com",
                      "user2@jsherz.com",
                    ],
                  },
                },
              },
            ],
          },
          null,
          2,
        ),
      });
    });
  });
});
