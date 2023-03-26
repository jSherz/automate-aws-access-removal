import { IScpService } from "./scp.service";

export class MockScpService implements IScpService {
  updatePolicy(): Promise<string> {
    return Promise.resolve("dummy policy");
  }
}
