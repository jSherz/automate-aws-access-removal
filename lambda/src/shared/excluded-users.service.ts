import {
  AttributeValue,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { logger } from "./powertools";

export interface IExcludedUsersService {
  excludeUser(id: string): Promise<void>;

  removeUserExclusion(id: string): Promise<void>;

  getExcludedUsers(): Promise<string[]>;

  takeLock(user: string): Promise<void>;

  releaseLock(): Promise<void>;
}

export class ExcludedUsersService implements IExcludedUsersService {
  private static Key = "EXCLUDED_USERS";

  private static LockKey = "LOCK";

  private static TwentyFourHoursInMs = 86400 * 1000;

  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async excludeUser(id: string): Promise<void> {
    const existing = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: ExcludedUsersService.Key,
          },
        },
      }),
    );

    const condition: Partial<PutItemCommandInput> = existing.Item
      ? {
          ConditionExpression: "#LastUpdatedAt = :lastUpdatedAt",
          ExpressionAttributeNames: {
            "#LastUpdatedAt": "lastUpdatedAt",
          },
          ExpressionAttributeValues: {
            ":lastUpdatedAt": existing.Item.lastUpdatedAt,
          },
        }
      : {
          ConditionExpression: "attribute_not_exists(#LastUpdatedAt)",
          ExpressionAttributeNames: {
            "#LastUpdatedAt": "lastUpdatedAt",
          },
        };

    const now = new Date();

    // We trust our use of the data
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          id: {
            S: ExcludedUsersService.Key,
          },
          excludedUsers: {
            L: [
              ...(existing.Item?.excludedUsers.L?.filter(user => {
                const parsedDate = new Date(user.M!.expiresAt.S!);

                return (
                  now.getTime() - parsedDate.getTime() <
                  ExcludedUsersService.TwentyFourHoursInMs
                );
              }) || []),
              {
                M: {
                  username: {
                    S: id,
                  },
                  expiresAt: {
                    S: new Date(
                      new Date().getTime() +
                        ExcludedUsersService.TwentyFourHoursInMs,
                    ).toISOString(),
                  },
                },
              },
            ],
          },
          lastUpdatedAt: {
            S: new Date().toISOString(),
          },
        },
        ...condition,
      }),
    );
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
  }

  async removeUserExclusion(id: string): Promise<void> {
    const existing = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: ExcludedUsersService.Key,
          },
        },
      }),
    );

    if (existing.Item) {
      // We trust our use of the data
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const withUserRemoved = existing.Item.excludedUsers.L!.filter(
        excludedUser => excludedUser.M?.username.S !== id,
      );

      // We trust our use of the data
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (withUserRemoved.length !== existing.Item.excludedUsers.L!.length) {
        await this.client.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: {
              id: {
                S: ExcludedUsersService.Key,
              },
              excludedUsers: {
                L: withUserRemoved,
              },
              lastUpdatedAt: {
                S: new Date().toISOString(),
              },
            },
            ConditionExpression: "#LastUpdatedAt = :lastUpdatedAt",
            ExpressionAttributeNames: {
              "#LastUpdatedAt": "lastUpdatedAt",
            },
            ExpressionAttributeValues: {
              ":lastUpdatedAt": existing.Item.lastUpdatedAt,
            },
          }),
        );
      }
    }
  }

  async getExcludedUsers(): Promise<string[]> {
    const existing = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: ExcludedUsersService.Key,
          },
        },
        /*
          This is a very low volume application, and we value consistency over
          performance and cost.
         */
        ConsistentRead: true,
      }),
    );

    if (existing.Item) {
      const now = new Date();

      // We trust our use of the data
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      return existing.Item.excludedUsers
        .L!.filter(user => {
          const parsedDate = new Date(user.M!.expiresAt.S!);

          return (
            now.getTime() - parsedDate.getTime() <
            ExcludedUsersService.TwentyFourHoursInMs
          );
        })
        .map(excludedUser => excludedUser.M!.username.S!)
        .sort();
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    } else {
      return [];
    }
  }

  async takeLock(user: string): Promise<void> {
    let lockTakeAttempts = 0;
    let lastFetchedLock: Record<string, AttributeValue> | undefined = void 0;

    while (lockTakeAttempts < 10) {
      const existingLock = await this.client.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: {
            id: {
              S: ExcludedUsersService.LockKey,
            },
          },
          ConsistentRead: true,
        }),
      );

      if (existingLock.Item) {
        lastFetchedLock = existingLock.Item;

        logger.info("lock already set - waiting before checking again", {
          existingLock: existingLock.Item,
        });

        await new Promise(resolve =>
          setTimeout(resolve, Math.random() * 1000 + 500),
        );

        lockTakeAttempts++;
      } else {
        break;
      }
    }

    if (lockTakeAttempts === 10) {
      throw new Error(
        `failed to take lock - one already exists: ${JSON.stringify(
          lastFetchedLock,
        )}`,
      );
    }

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          id: {
            S: ExcludedUsersService.LockKey,
          },
          takenBy: {
            S: user,
          },
          takenAt: {
            S: new Date().toISOString(),
          },
        },
        ConditionExpression: "attribute_not_exists(#TakenBy)",
        ExpressionAttributeNames: {
          "#TakenBy": "takenBy",
        },
      }),
    );
  }

  async releaseLock(): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: ExcludedUsersService.LockKey,
          },
        },
      }),
    );
  }
}
