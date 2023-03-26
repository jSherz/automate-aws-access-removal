import { ICloudTrailEvent } from "../../shared/types";
import { logger } from "../../shared/powertools";
import { IDirectoryService } from "../../shared/directory.service";
import { IExcludedUsersService } from "../../shared/excluded-users.service";

export function buildHandler(
  directoryService: IDirectoryService,
  excludedUsersService: IExcludedUsersService,
) {
  return async function unwrappedHandler(
    event: ICloudTrailEvent<"EnableUser">,
  ) {
    const userId = event.detail.requestParameters.userId;

    const email = await directoryService.usernameForId(userId);

    await excludedUsersService.removeUserExclusion(email);

    logger.info("removed user exclusion", { userId, email });
  };
}
