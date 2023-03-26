import {
  BillingMode,
  ConditionalCheckFailedException,
  CreateTableCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  KeyType,
  PutItemCommand,
  ScalarAttributeType,
  TableStatus,
} from "@aws-sdk/client-dynamodb";
import * as crypto from "crypto";
import { ExcludedUsersService } from "./excluded-users.service";
import { mockClient } from "aws-sdk-client-mock";

async function retryIfConditAccessErr(fn: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        // Ignore
        await new Promise(resolve =>
          setTimeout(resolve, Math.random() * 30 + 10),
        );
      } else {
        throw err;
      }
    }
  }
}

describe("ExcludedUsersService", () => {
  const client = new DynamoDBClient(
    process.env.DYNAMODB_ENDPOINT
      ? {
          endpoint: process.env.DYNAMODB_ENDPOINT,
          // Use dummy credentials if we're using DynamoDB local
          credentials: process.env.DYNAMODB_ENDPOINT.startsWith("http://")
            ? {
                accessKeyId: "unused",
                secretAccessKey: "unused",
              }
            : void 0,
        }
      : {},
  );

  function withFreshTable(fn: (tableName: string) => void) {
    const tableName = `automate-aws-access-removal-tests-${crypto.randomUUID()}`;

    return async function () {
      const operation = await client.send(
        new CreateTableCommand({
          TableName: tableName,
          BillingMode: BillingMode.PAY_PER_REQUEST,
          KeySchema: [
            {
              AttributeName: "id",
              KeyType: KeyType.HASH,
            },
          ],
          AttributeDefinitions: [
            { AttributeName: "id", AttributeType: ScalarAttributeType.S },
          ],
          SSESpecification: {
            Enabled: true,
          },
          Tags: [
            {
              Key: "project",
              Value: "automate-aws-access-removal",
            },
          ],
        }),
      );

      if (operation.TableDescription?.TableStatus !== TableStatus.ACTIVE) {
        let created = false;

        while (!created) {
          const describeResult = await client.send(
            new DescribeTableCommand({
              TableName: tableName,
            }),
          );

          if (describeResult.Table?.TableStatus === TableStatus.ACTIVE) {
            created = true;
          } else {
            await new Promise(resolve =>
              setTimeout(resolve, Math.random() * 1000 + 500),
            );
          }
        }
      }

      try {
        await fn(tableName);
      } finally {
        await client.send(
          new DeleteTableCommand({
            TableName: tableName,
          }),
        );
      }
    };
  }

  describe("when there are no excluded users", () => {
    describe("when a user is excluded", () => {
      it(
        "stores the exclusion",
        withFreshTable(async tableName => {
          const service = new ExcludedUsersService(client, tableName);

          await service.excludeUser("test-user1@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user1@example.com",
          ]);
        }),
      );
    });

    describe("when a user's exclusion is removed", () => {
      it(
        "does nothing",
        withFreshTable(async tableName => {
          const service = new ExcludedUsersService(client, tableName);

          await service.removeUserExclusion("test-user2@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([]);
        }),
      );
    });
  });

  describe("when there are existing excluded users", () => {
    describe("when a user is excluded", () => {
      it(
        "adds their exclusion",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user3@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user4@example.com",
                        },
                        expiresAt: {
                          S: "2047-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user5@example.com",
                        },
                        expiresAt: {
                          S: "2037-09-21T15:21:00.921Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await service.excludeUser("test-user6@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user3@example.com",
            "test-user4@example.com",
            "test-user5@example.com",
            "test-user6@example.com",
          ]);
        }),
      );

      it(
        "removes any users excluded more than 24 hours ago",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user24@example.com",
                        },
                        expiresAt: {
                          S: "2023-04-07T18:55:04.361Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user25@example.com",
                        },
                        expiresAt: {
                          S: "2000-04-07T18:55:04.361Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user26@example.com",
                        },
                        expiresAt: {
                          S: "3000-01-01T08:00:01.128Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await service.excludeUser("test-user27@example.com");

          const excludedUsers = await client.send(
            new GetItemCommand({
              TableName: tableName,
              Key: {
                id: {
                  S: "EXCLUDED_USERS",
                },
              },
            }),
          );

          expect(excludedUsers.Item?.excludedUsers.L).toHaveLength(2);

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user26@example.com",
            "test-user27@example.com",
          ]);
        }),
      );
    });

    describe("when a previously excluded user is excluded again", () => {
      it(
        "does nothing",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user7@example.com",
                        },
                        expiresAt: {
                          S: "2057-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user8@example.com",
                        },
                        expiresAt: {
                          S: "2067-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user9@example.com",
                        },
                        expiresAt: {
                          S: "2077-09-21T15:21:00.921Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await service.removeUserExclusion("test-user-blah@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user7@example.com",
            "test-user8@example.com",
            "test-user9@example.com",
          ]);
        }),
      );
    });

    describe("when a user's exclusion is removed", () => {
      it(
        "removes the exclusion",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user10@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user11@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user12@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user13@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user14@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await service.removeUserExclusion("test-user10@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user11@example.com",
            "test-user12@example.com",
            "test-user13@example.com",
            "test-user14@example.com",
          ]);
        }),
      );
    });

    describe("when an unknown user's exclusion is removed", () => {
      it(
        "does nothing",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user15@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user16@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await service.removeUserExclusion("test-user17@example.com");

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user15@example.com",
            "test-user16@example.com",
          ]);
        }),
      );
    });

    describe("when multiple read and write operations are raced", () => {
      it(
        "throws until every operation has been completed, without any malformed data",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user18@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user23@example.com",
                        },
                        expiresAt: {
                          S: "2027-09-21T15:21:00.921Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await Promise.all([
            retryIfConditAccessErr(() =>
              service.excludeUser("test-user19@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.removeUserExclusion("test-user23@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.excludeUser("test-user20@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.removeUserExclusion("test-user18@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.excludeUser("test-user21@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.removeUserExclusion("test-user-unknown@example.com"),
            ),
            retryIfConditAccessErr(() =>
              service.excludeUser("test-user22@example.com"),
            ),
          ]);

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user19@example.com",
            "test-user20@example.com",
            "test-user21@example.com",
            "test-user22@example.com",
          ]);
        }),
      );
    });

    describe("when entries are more than 24 hours old", () => {
      it(
        "they are not returned",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "EXCLUDED_USERS",
                },
                excludedUsers: {
                  L: [
                    {
                      M: {
                        username: {
                          S: "test-user3@example.com",
                        },
                        expiresAt: {
                          S: "2023-04-07T18:55:04.361Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user4@example.com",
                        },
                        expiresAt: {
                          S: "2000-04-07T18:55:04.361Z",
                        },
                      },
                    },
                    {
                      M: {
                        username: {
                          S: "test-user5@example.com",
                        },
                        expiresAt: {
                          S: "3000-01-01T08:00:01.128Z",
                        },
                      },
                    },
                  ],
                },
                lastUpdatedAt: {
                  S: new Date().toISOString(),
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          await expect(service.getExcludedUsers()).resolves.toEqual([
            "test-user5@example.com",
          ]);
        }),
      );
    });
  });

  describe("when taking the lock", () => {
    describe("when the lock is already taken", () => {
      it(
        "retries until it's available",
        withFreshTable(async tableName => {
          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "LOCK",
                },
                takenBy: {
                  S: "CI test",
                },
                takenAt: {
                  S: "2023-04-04T19:59:01.939Z",
                },
              },
            }),
          );

          const service = new ExcludedUsersService(client, tableName);

          const releaseLockPromise = new Promise<void>((resolve, reject) => {
            setTimeout(async () => {
              try {
                await client.send(
                  new DeleteItemCommand({
                    TableName: tableName,
                    Key: {
                      id: {
                        S: "LOCK",
                      },
                    },
                  }),
                );
                resolve();
              } catch (err) {
                reject(err);
              }
            }, 1500);
          });

          try {
            await service.takeLock("bob");

            const result = await client.send(
              new GetItemCommand({
                TableName: tableName,
                Key: {
                  id: {
                    S: "LOCK",
                  },
                },
                ConsistentRead: true,
              }),
            );

            expect(result.Item).toBeDefined();
            expect(result.Item?.takenBy.S).toEqual("bob");
            expect(result.Item?.takenAt.S).toBeDefined();

            // We assume we've correctly set the data to be in the structure we expect
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const takenAt = new Date(result.Item!.takenAt.S!);
            const now = new Date();
            expect(takenAt.getTime() - now.getTime()).toBeLessThan(5000);
          } finally {
            await releaseLockPromise;
          }
        }),
      );

      describe("when the lock is not given up", () => {
        it(
          "throws an error",
          withFreshTable(async tableName => {
            await client.send(
              new PutItemCommand({
                TableName: tableName,
                Item: {
                  id: {
                    S: "LOCK",
                  },
                  takenBy: {
                    S: "CI test 2",
                  },
                  takenAt: {
                    S: "2023-04-04T21:10:00.314Z",
                  },
                },
              }),
            );

            const service = new ExcludedUsersService(client, tableName);

            await expect(service.takeLock("bob")).rejects.toThrow(
              /failed to take lock/,
            );
          }),
        );
      });
    });

    describe("when there is no lock previously taken", () => {
      it(
        "takes the lock",
        withFreshTable(async tableName => {
          const service = new ExcludedUsersService(client, tableName);

          await service.takeLock("kristen");

          const result = await client.send(
            new GetItemCommand({
              TableName: tableName,
              Key: {
                id: {
                  S: "LOCK",
                },
              },
              ConsistentRead: true,
            }),
          );

          expect(result.Item).toBeDefined();
          expect(result.Item?.takenBy.S).toEqual("kristen");
          expect(result.Item?.takenAt.S).toBeDefined();

          // We trust our use of the data
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const takenAt = new Date(result.Item!.takenAt.S!);
          const now = new Date();
          expect(takenAt.getTime() - now.getTime()).toBeLessThan(5000);
        }),
      );
    });

    describe("when a user beats us to getting the lock", () => {
      it("throws an error", async () => {
        const realClient = new DynamoDBClient({});

        /**
         * NB: do not call mockClient on the class DynamoDBClient - use an
         * instance to avoid polluting other calls.
         */
        const clientMock = mockClient(realClient);

        const service = new ExcludedUsersService(realClient, "unused");

        clientMock.on(GetItemCommand).resolvesOnce({
          Item: void 0,
        });

        clientMock.on(PutItemCommand).rejectsOnce(
          new ConditionalCheckFailedException({
            $metadata: {} as any,
            message: "fake condition failed",
          }),
        );

        await expect(service.takeLock("12345")).rejects.toThrowError(
          /fake condition failed/,
        );
      });
    });
  });

  describe("when releasing the lock", () => {
    describe("when the lock does not exist", () => {
      it(
        "does nothing",
        withFreshTable(async tableName => {
          const service = new ExcludedUsersService(client, tableName);

          await expect(service.releaseLock()).resolves.toBeUndefined();
        }),
      );
    });

    describe("when the lock exists", () => {
      it(
        "releases the lock",
        withFreshTable(async tableName => {
          const service = new ExcludedUsersService(client, tableName);

          await client.send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                id: {
                  S: "LOCK",
                },
                takenBy: {
                  S: "CI release test",
                },
                takenAt: {
                  S: "2023-04-06T17:31:27.133Z",
                },
              },
            }),
          );

          await expect(service.releaseLock()).resolves.toBeUndefined();

          const matchingLock = await client.send(
            new GetItemCommand({
              TableName: tableName,
              Key: {
                id: {
                  S: "LOCK",
                },
              },
              ConsistentRead: true,
            }),
          );

          expect(matchingLock.Item).toBeUndefined();
        }),
      );
    });
  });
});
