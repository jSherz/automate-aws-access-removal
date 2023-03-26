import { buildHandler } from "./handler";
import { MockExcludedUsersService } from "../../shared/excluded-users.service.mock";
import { MockScpService } from "../../shared/scp.service.mock";

describe("excluded-users-listener", () => {
  describe("when the event is not for excluded users", () => {
    it("it's ignored", async () => {
      const excludedUsersService = new MockExcludedUsersService();
      const scpService = new MockScpService();

      const getExcludedUsersSpy = jest.spyOn(
        excludedUsersService,
        "getExcludedUsers",
      );

      const updatePolicySpy = jest.spyOn(scpService, "updatePolicy");

      const handler = buildHandler(excludedUsersService, scpService);

      await handler(
        {
          Records: [
            {
              eventID: "d21f69f614026a1c22ff5ad6330a6842",
              eventName: "INSERT",
              eventVersion: "1.1",
              eventSource: "aws:dynamodb",
              awsRegion: "eu-west-1",
              dynamodb: {
                ApproximateCreationDateTime: 1680968263,
                Keys: { id: { S: "LOCK" } },
                NewImage: {
                  takenBy: { S: "cea8bc73-2f08-46e9-bc1e-edd2d5d1e2a6" },
                  takenAt: { S: "2023-04-08T15:37:43.607Z" },
                  id: { S: "LOCK" },
                },
                SequenceNumber: "28052300000000038580321551",
                SizeBytes: 86,
                StreamViewType: "NEW_IMAGE",
              },
              eventSourceARN:
                "arn:aws:dynamodb:eu-west-1:123456789012:table/auto-access-rem-excluded-users/stream/2023-04-02T15:22:37.247",
            },
          ],
        },
        {} as any,
      );

      expect(getExcludedUsersSpy).not.toHaveBeenCalled();

      expect(updatePolicySpy).not.toHaveBeenCalled();
    });
  });

  it("updates the SCP with excluded users", async () => {
    const excludedUsersService = new MockExcludedUsersService();
    const scpService = new MockScpService();

    const updatePolicySpy = jest.spyOn(scpService, "updatePolicy");

    const handler = buildHandler(excludedUsersService, scpService);

    await excludedUsersService.excludeUser("test-user-1@jsherz.com");
    await excludedUsersService.excludeUser("test-user-2@jsherz.com");
    await excludedUsersService.excludeUser("test-user-3@jsherz.com");

    await handler(
      {
        Records: [
          {
            eventID: "8efa55850fd13f1eb073ea6e7d9a1f51",
            eventName: "MODIFY",
            eventVersion: "1.1",
            eventSource: "aws:dynamodb",
            awsRegion: "eu-west-1",
            dynamodb: {
              ApproximateCreationDateTime: 1680968263,
              Keys: { id: { S: "EXCLUDED_USERS" } },
              NewImage: {
                excludedUsers: { L: [{ S: "james+foo@jsherz.com" }] },
                lastUpdatedAt: { S: "2023-04-08T15:37:42.993Z" },
                id: { S: "EXCLUDED_USERS" },
              },
              SequenceNumber: "28052200000000038580319844",
              SizeBytes: 106,
              StreamViewType: "NEW_IMAGE",
            },
            eventSourceARN:
              "arn:aws:dynamodb:eu-west-1:123456789012:table/auto-access-rem-excluded-users/stream/2023-04-02T15:22:37.247",
          },
        ],
      },
      {} as any,
    );

    /*
      NB: we ignore the NEW_IMAGE above and fetch the users fresh from DynamoDB.
     */
    expect(updatePolicySpy).toHaveBeenCalledWith([
      "test-user-1@jsherz.com",
      "test-user-2@jsherz.com",
      "test-user-3@jsherz.com",
    ]);
  });

  describe("when getting the excluded users fails", () => {
    it("still releases the lock", async () => {
      const excludedUsersService = new MockExcludedUsersService();
      const scpService = new MockScpService();

      const takeLockSpy = jest.spyOn(excludedUsersService, "takeLock");

      const releaseLockSpy = jest.spyOn(excludedUsersService, "releaseLock");

      const getExcludedUsersSpy = jest
        .spyOn(excludedUsersService, "getExcludedUsers")
        .mockRejectedValueOnce(new Error("oh no! something happened"));

      const handler = buildHandler(excludedUsersService, scpService);

      await expect(
        handler(
          {
            Records: [
              {
                eventID: "8efa55850fd13f1eb073ea6e7d9a1f51",
                eventName: "MODIFY",
                eventVersion: "1.1",
                eventSource: "aws:dynamodb",
                awsRegion: "eu-west-1",
                dynamodb: {
                  ApproximateCreationDateTime: 1680968263,
                  Keys: { id: { S: "EXCLUDED_USERS" } },
                  NewImage: {
                    excludedUsers: { L: [{ S: "james+foo@jsherz.com" }] },
                    lastUpdatedAt: { S: "2023-04-08T15:37:42.993Z" },
                    id: { S: "EXCLUDED_USERS" },
                  },
                  SequenceNumber: "28052200000000038580319844",
                  SizeBytes: 106,
                  StreamViewType: "NEW_IMAGE",
                },
                eventSourceARN:
                  "arn:aws:dynamodb:eu-west-1:123456789012:table/auto-access-rem-excluded-users/stream/2023-04-02T15:22:37.247",
              },
            ],
          },
          {} as any,
        ),
      ).rejects.toThrowError(/oh no/);

      expect(takeLockSpy).toHaveBeenCalled();

      expect(getExcludedUsersSpy).toHaveBeenCalled();

      expect(releaseLockSpy).toHaveBeenCalled();
    });
  });

  describe("when updating the SCP fails", () => {
    it("still releases the lock", async () => {
      const excludedUsersService = new MockExcludedUsersService();
      const scpService = new MockScpService();

      const takeLockSpy = jest.spyOn(excludedUsersService, "takeLock");

      const releaseLockSpy = jest.spyOn(excludedUsersService, "releaseLock");

      const updatePolicySpy = jest
        .spyOn(scpService, "updatePolicy")
        .mockRejectedValueOnce(new Error("oh no! something happened"));

      const handler = buildHandler(excludedUsersService, scpService);

      await expect(
        handler(
          {
            Records: [
              {
                eventID: "8efa55850fd13f1eb073ea6e7d9a1f51",
                eventName: "MODIFY",
                eventVersion: "1.1",
                eventSource: "aws:dynamodb",
                awsRegion: "eu-west-1",
                dynamodb: {
                  ApproximateCreationDateTime: 1680968263,
                  Keys: { id: { S: "EXCLUDED_USERS" } },
                  NewImage: {
                    excludedUsers: { L: [{ S: "james+foo@jsherz.com" }] },
                    lastUpdatedAt: { S: "2023-04-08T15:37:42.993Z" },
                    id: { S: "EXCLUDED_USERS" },
                  },
                  SequenceNumber: "28052200000000038580319844",
                  SizeBytes: 106,
                  StreamViewType: "NEW_IMAGE",
                },
                eventSourceARN:
                  "arn:aws:dynamodb:eu-west-1:123456789012:table/auto-access-rem-excluded-users/stream/2023-04-02T15:22:37.247",
              },
            ],
          },
          {} as any,
        ),
      ).rejects.toThrowError(/oh no/);

      expect(takeLockSpy).toHaveBeenCalled();

      expect(updatePolicySpy).toHaveBeenCalled();

      expect(releaseLockSpy).toHaveBeenCalled();
    });
  });
});
