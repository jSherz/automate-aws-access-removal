data "node-lambda-packager_package" "this" {
  args = [
    "--bundle",
    "--external:@aws-sdk*",
    "--external:@aws-lambda-powertools*",
    "--minify",
    "--platform=node",
    "--sourcemap",
    "--target=es2021",
    "--sourcemap=inline",
  ]

  entrypoint        = var.entrypoint
  working_directory = var.working_directory
}

resource "aws_lambda_function" "this" {
  function_name    = var.name
  role             = aws_iam_role.this.arn
  architectures    = ["arm64"]
  description      = var.description
  handler          = "index.handler"
  memory_size      = var.memory_size
  runtime          = "nodejs18.x"
  filename         = data.node-lambda-packager_package.this.filename
  source_code_hash = data.node-lambda-packager_package.this.source_code_hash

  reserved_concurrent_executions = var.reserved_concurrent_executions

  environment {
    variables = var.env_vars
  }

  layers = [
    # See: https://awslabs.github.io/aws-lambda-powertools-typescript/latest/
    "arn:aws:lambda:${data.aws_region.this.name}:094274105915:layer:AWSLambdaPowertoolsTypeScript:10",
  ]

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_cloudwatch_log_group.this]
}

data "aws_arn" "event_rules" {
  for_each = var.event_rule_arns

  arn = each.value
}

resource "aws_lambda_permission" "event_rules" {
  for_each = var.event_rule_arns

  statement_id   = "allow-execution-by-event-rule-${each.key}"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.this.function_name
  principal      = "events.amazonaws.com"
  source_arn     = each.value
  source_account = data.aws_arn.event_rules[each.key].account
}

resource "aws_cloudwatch_event_target" "event_targets" {
  for_each = var.event_rule_arns

  arn  = aws_lambda_function.this.arn
  rule = replace(data.aws_arn.event_rules[each.key].resource, "rule/", "")
}
