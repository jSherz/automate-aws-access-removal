import { IDirectoryService } from "./directory.service";

export class MockDirectoryService implements IDirectoryService {
  usernameForId(): Promise<string> {
    return Promise.reject(new Error("you must configure this mock"));
  }
}
