import { buildHandler } from "./handler";
import { MockDirectoryService } from "../../shared/directory.service.mock";
import { MockExcludedUsersService } from "../../shared/excluded-users.service.mock";

describe("user-deleted-listener", () => {
  it("looks up the user email and excludes the user", async () => {
    const directoryService = new MockDirectoryService();
    const excludedUsersService = new MockExcludedUsersService();

    const usernameForIdSpy = jest.spyOn(directoryService, "usernameForId");

    const excludeUserSpy = jest.spyOn(excludedUsersService, "excludeUser");

    const handler = buildHandler(directoryService, excludedUsersService);

    usernameForIdSpy.mockResolvedValueOnce("bob@jsherz.com");

    await handler({
      version: "0",
      id: "6b723911-eeb0-80f9-cf88-ea8d61e7c583",
      "detail-type": "AWS API Call via CloudTrail",
      source: "aws.sso-directory",
      account: "123456789012",
      time: "2023-04-08T15:36:49Z",
      region: "eu-west-1",
      resources: [],
      detail: {
        eventVersion: "1.08",
        userIdentity: {
          type: "Unknown",
          accountId: "123456789012",
          accessKeyId: "1d0e1b72-d0e0-4acb-9dbb-d65da93538b5",
        },
        eventTime: "2023-03-26T17:07:35Z",
        eventSource: "sso-directory.amazonaws.com",
        eventName: "DeleteUser",
        awsRegion: "eu-west-1",
        sourceIPAddress: "123.123.123.123",
        userAgent: "PostmanRuntime/7.26.8",
        requestParameters: {
          identityStoreId: "d-93670dc30f",
          userId: "22c554e4-c091-708a-0ec5-08b46733f1a2",
        },
        responseElements: null,
        requestID: "ff339372-4a0b-4685-bb9a-116b85ddab23",
        eventID: "e672baaa-a7dc-457b-9628-848bdb1d9e86",
        readOnly: false,
        eventType: "AwsApiCall",
        managementEvent: true,
        recipientAccountId: "123456789012",
        eventCategory: "Management",
        tlsDetails: {
          tlsVersion: "TLSv1.2",
          cipherSuite: "ECDHE-RSA-AES128-GCM-SHA256",
          clientProvidedHostHeader: "up.sso.eu-west-1.amazonaws.com",
        },
      },
    });

    expect(usernameForIdSpy).toHaveBeenCalledWith(
      "22c554e4-c091-708a-0ec5-08b46733f1a2",
    );

    expect(excludeUserSpy).toHaveBeenCalledWith("bob@jsherz.com");
  });
});
