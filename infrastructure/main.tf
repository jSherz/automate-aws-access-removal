resource "aws_xray_sampling_rule" "this" {
  rule_name      = "automate-aws-access-removal"
  fixed_rate     = 1 # 100%
  host           = "*"
  http_method    = "*"
  priority       = 1000
  reservoir_size = 10
  resource_arn   = "*"
  service_name   = "automate-aws-access-removal"
  service_type   = "*"
  url_path       = "*"
  version        = 1
}

data "aws_iam_policy_document" "identity_center_event_listeners" {
  statement {
    sid    = "AllowUseOfDdbTable"
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]

    resources = [aws_dynamodb_table.excluded_users.arn]
  }

  statement {
    sid    = "AllowUpdateOfOrgPolicy"
    effect = "Allow"

    actions = [
      "organizations:UpdatePolicy"
    ]

    resources = [aws_organizations_policy.excluded_users_scp.arn]
  }

  statement {
    sid    = "AllowDescribingUsers"
    effect = "Allow"

    actions = [
      "identitystore:DescribeUser",
    ]

    resources = [
      "arn:aws:identitystore::${data.aws_caller_identity.this.account_id}:identitystore/${var.identity_store_id}",
      "arn:aws:identitystore:::user/*",
    ]
  }
}

resource "aws_cloudwatch_event_rule" "delete_user" {
  name = "${var.prefix}-delete-user"

  event_pattern = jsonencode({
    detail-type = ["AWS API Call via CloudTrail"]
    source      = ["aws.sso-directory"]
    detail = {
      eventName = ["DeleteUser"]
    }
  })
}

module "user_deleted_listener" {
  source = "./modules/lambda-function"

  name              = "${var.prefix}-user-deleted-listener"
  description       = "Called when Identity Center users are updated with a PATCH or PUT operation."
  entrypoint        = "../lambda/src/handlers/user-deleted-listener/index.ts"
  working_directory = "../lambda"
  iam_policy        = data.aws_iam_policy_document.identity_center_event_listeners.json

  event_rule_arns = {
    "delete-user" : aws_cloudwatch_event_rule.delete_user.arn,
  }

  env_vars = {
    TABLE_NAME        = aws_dynamodb_table.excluded_users.name
    IDENTITY_STORE_ID = var.identity_store_id
  }
}

resource "aws_cloudwatch_event_rule" "disable_user" {
  name = "${var.prefix}-disable-user"

  event_pattern = jsonencode({
    detail-type = ["AWS API Call via CloudTrail"]
    source      = ["aws.sso-directory"]
    detail = {
      eventName = ["DisableUser"]
    }
  })
}

module "user_disabled_listener" {
  source = "./modules/lambda-function"

  name              = "${var.prefix}-user-disabled-listener"
  description       = "Called when Identity Center users are disabled."
  entrypoint        = "../lambda/src/handlers/user-disabled-listener/index.ts"
  working_directory = "../lambda"
  iam_policy        = data.aws_iam_policy_document.identity_center_event_listeners.json

  event_rule_arns = {
    "disable-user" : aws_cloudwatch_event_rule.disable_user.arn,
  }

  env_vars = {
    TABLE_NAME        = aws_dynamodb_table.excluded_users.name
    IDENTITY_STORE_ID = var.identity_store_id
  }
}

resource "aws_cloudwatch_event_rule" "enable_user" {
  name = "${var.prefix}-enable-user"

  event_pattern = jsonencode({
    detail-type = ["AWS API Call via CloudTrail"]
    source      = ["aws.sso-directory"]
    detail = {
      eventName = ["EnableUser"]
    }
  })
}

module "user_enabled_listener" {
  source = "./modules/lambda-function"

  name              = "${var.prefix}-user-enabled-listener"
  description       = "Called when Identity Center users are enabled."
  entrypoint        = "../lambda/src/handlers/user-enabled-listener/index.ts"
  working_directory = "../lambda"
  iam_policy        = data.aws_iam_policy_document.identity_center_event_listeners.json

  event_rule_arns = {
    "enable-user" : aws_cloudwatch_event_rule.enable_user.arn,
  }

  env_vars = {
    TABLE_NAME        = aws_dynamodb_table.excluded_users.name
    IDENTITY_STORE_ID = var.identity_store_id
  }
}

module "excluded_users_listener" {
  source = "./modules/lambda-function"

  name              = "${var.prefix}-excluded-users-listener"
  description       = "Called when the excluded users are updated in the DynamoDB table."
  entrypoint        = "../lambda/src/handlers/excluded-users-listener/index.ts"
  working_directory = "../lambda"
  iam_policy        = data.aws_iam_policy_document.identity_center_event_listeners.json

  env_vars = {
    TABLE_NAME      = aws_dynamodb_table.excluded_users.name
    SCP_ID          = aws_organizations_policy.excluded_users_scp.id
    SCP_NAME        = aws_organizations_policy.excluded_users_scp.name
    SCP_DESCRIPTION = aws_organizations_policy.excluded_users_scp.description
  }
}

module "excluded_users_listener_ddb_stream" {
  source = "./modules/lambda-function-dynamodb-stream"

  function_name = module.excluded_users_listener.name
  role_id       = module.excluded_users_listener.role_id

  subscriptions = {
    ddb = {
      stream_arn = aws_dynamodb_table.excluded_users.stream_arn
      batch_size = 1
    }
  }
}
