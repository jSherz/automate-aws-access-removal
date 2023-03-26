import type { Context } from "aws-lambda";
import { logger } from "../../shared/powertools";
import { IExcludedUsersService } from "../../shared/excluded-users.service";
import { IScpService } from "../../shared/scp.service";

interface IExcludedUsersStreamBody {
  ApproximateCreationDateTime: number;
  Keys: {
    id: {
      S: "EXCLUDED_USERS";
    };
  };
  NewImage: {
    excludedUsers: {
      L: Array<{ S: string }>;
    };
    lastUpdatedAt: {
      S: string;
    };
    id: {
      S: "EXCLUDED_USERS";
    };
  };
  SequenceNumber: string;
  SizeBytes: number;
  StreamViewType: "NEW_IMAGE";
}

interface ILockStreamBody {
  ApproximateCreationDateTime: number;
  Keys: {
    id: {
      S: "LOCK";
    };
  };
  NewImage: {
    takenBy: {
      S: string;
    };
    takenAt: {
      S: string;
    };
    id: {
      S: "LOCK";
    };
  };
  SequenceNumber: string;
  SizeBytes: number;
  StreamViewType: "NEW_IMAGE";
}

interface IStreamEvent<Body> {
  Records: [
    {
      eventID: string;
      eventName: string;
      eventVersion: "1.1";
      eventSource: "aws:dynamodb";
      awsRegion: string;
      dynamodb: Body;
      eventSourceARN: string;
    },
  ];
}

type IExcludedUsersStreamEvent = IStreamEvent<IExcludedUsersStreamBody>;

function isExcludedUsersStreamEvent(
  event: IStreamEvent<IExcludedUsersStreamBody | ILockStreamBody>,
): event is IExcludedUsersStreamEvent {
  return event.Records[0].dynamodb.Keys.id.S === "EXCLUDED_USERS";
}

export function buildHandler(
  excludedUsersService: IExcludedUsersService,
  scpService: IScpService,
) {
  return async function unwrappedHandler(
    event: IStreamEvent<IExcludedUsersStreamBody | ILockStreamBody>,
    context: Context,
  ) {
    if (!isExcludedUsersStreamEvent(event)) {
      logger.info("this is not an excluded users update - skipping");
      return;
    }

    await excludedUsersService.takeLock(context.awsRequestId);

    logger.info("acquired lock");

    try {
      const excludedUsers = await excludedUsersService.getExcludedUsers();

      const policy = await scpService.updatePolicy(excludedUsers);

      logger.info("updated SCP to exclude users", {
        excludedUsers,
        policy,
      });
    } finally {
      await excludedUsersService.releaseLock();

      logger.info("released lock");
    }
  };
}
