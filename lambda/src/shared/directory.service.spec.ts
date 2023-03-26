import { mockClient } from "aws-sdk-client-mock";
import {
  DescribeUserCommand,
  IdentitystoreClient,
} from "@aws-sdk/client-identitystore";
import { DirectoryService } from "./directory.service";

describe("DirectoryService", () => {
  describe("usernameForId", () => {
    it("returns the user's email (username)", async () => {
      const identityStoreClient = new IdentitystoreClient({});

      /**
       * NB: do not call mockClient on the class IdentitystoreClient - use an
       * instance to avoid polluting other calls.
       */
      const clientMock = mockClient(identityStoreClient);

      const service = new DirectoryService(identityStoreClient, "unused-id");

      clientMock
        .on(DescribeUserCommand, {
          UserId: "test-id-123",
          IdentityStoreId: "unused-id",
        })
        .resolvesOnce({
          UserName: "some-email@jsherz.com",
          UserId: "test-id-123",
          IdentityStoreId: "unused-id",
        });

      await expect(service.usernameForId("test-id-123")).resolves.toEqual(
        "some-email@jsherz.com",
      );
    });
  });
});
