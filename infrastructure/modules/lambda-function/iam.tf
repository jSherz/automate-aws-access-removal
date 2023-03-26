data "aws_iam_policy_document" "this_assume" {
  statement {
    sid     = "AllowLambdaToAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name = "lambda-${var.name}"

  assume_role_policy = data.aws_iam_policy_document.this_assume.json
}

resource "aws_iam_role_policy" "this" {
  role   = aws_iam_role.this.id
  policy = var.iam_policy
}

resource "aws_iam_role_policy_attachment" "basic_execution_role" {
  role       = aws_iam_role.this.id
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "tracing" {
  role       = aws_iam_role.this.id
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
