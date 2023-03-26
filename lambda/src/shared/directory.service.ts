import {
  DescribeUserCommand,
  IdentitystoreClient,
} from "@aws-sdk/client-identitystore";

export interface IDirectoryService {
  usernameForId(userId: string): Promise<string>;
}

export class DirectoryService implements IDirectoryService {
  constructor(
    private readonly identityStoreClient: IdentitystoreClient,
    private readonly identityStoreId: string,
  ) {}

  async usernameForId(userId: string): Promise<string> {
    const user = await this.identityStoreClient.send(
      new DescribeUserCommand({
        UserId: userId,
        IdentityStoreId: this.identityStoreId,
      }),
    );

    // A username is always set
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return user.UserName!;
  }
}
