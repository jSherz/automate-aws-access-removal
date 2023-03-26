import { IExcludedUsersService } from "./excluded-users.service";

export class MockExcludedUsersService implements IExcludedUsersService {
  private readonly excludedUsers: string[] = [];

  excludeUser(id: string): Promise<void> {
    this.excludedUsers.push(id);
    return Promise.resolve();
  }

  getExcludedUsers(): Promise<string[]> {
    return Promise.resolve(this.excludedUsers);
  }

  releaseLock(): Promise<void> {
    return Promise.resolve();
  }

  removeUserExclusion(id: string): Promise<void> {
    const index = this.excludedUsers.indexOf(id);

    if (index !== -1) {
      this.excludedUsers.splice(index, 1);
    }

    return Promise.resolve();
  }

  takeLock(): Promise<void> {
    return Promise.resolve();
  }
}
