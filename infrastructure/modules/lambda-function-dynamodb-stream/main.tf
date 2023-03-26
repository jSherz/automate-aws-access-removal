resource "aws_sqs_queue" "this" {
  for_each = var.subscriptions

  name = "${var.function_name}-${each.key}-dlq"
}

data "aws_iam_policy_document" "this" {
  statement {
    sid       = "AllowUseOfDlq"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [for k, v in aws_sqs_queue.this : v.arn]
  }

  statement {
    sid    = "AllowReadingDdbStreams"
    effect = "Allow"
    actions = [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
    ]
    resources = [for k, v in var.subscriptions : v.stream_arn]
  }

  statement {
    sid       = "AllowListingStreams"
    effect    = "Allow"
    actions   = ["dynamodb:ListStreams"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "this" {
  name   = "${var.function_name}-ddb-streams"
  policy = data.aws_iam_policy_document.this.json
}

resource "aws_iam_role_policy_attachment" "this" {
  role       = var.role_id
  policy_arn = aws_iam_policy.this.arn
}

resource "aws_lambda_permission" "dlq" {
  for_each = var.subscriptions

  function_name = var.function_name

  action         = "lambda:InvokeFunction"
  principal      = "dynamodb.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
  source_arn     = each.value.stream_arn
  statement_id   = "AllowSendingMessagesToDlq-${each.key}"
}

resource "aws_lambda_event_source_mapping" "this" {
  for_each = var.subscriptions

  depends_on = [aws_iam_policy.this]

  function_name     = var.function_name
  event_source_arn  = each.value.stream_arn
  starting_position = "LATEST"
  batch_size        = each.value.batch_size

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.this[each.key].arn
    }
  }

  maximum_retry_attempts = 10
}
