export interface ICloudTrailEvent<EventName> {
  version: "0";
  id: string;
  "detail-type": "AWS API Call via CloudTrail";
  source: "aws.sso-directory";
  account: string;
  time: string;
  region: string;
  resources: unknown;
  detail: {
    eventVersion: "1.08";
    userIdentity: unknown;
    eventTime: string;
    eventSource: "sso-directory.amazonaws.com";
    eventName: EventName;
    awsRegion: string;
    sourceIPAddress: string;
    userAgent: string;
    requestParameters: {
      identityStoreId: string;
      userId: string;
    };
    responseElements: unknown;
    requestID: string;
    eventID: string;
    readOnly: boolean;
    eventType: "AwsApiCall";
    managementEvent: boolean;
    recipientAccountId: string;
    eventCategory: "Management";
    tlsDetails: unknown;
  };
}
