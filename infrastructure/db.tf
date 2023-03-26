resource "aws_dynamodb_table" "excluded_users" {
  name = "${var.prefix}-excluded-users"

  attribute {
    name = "id"
    type = "S"
  }

  hash_key     = "id"
  billing_mode = "PAY_PER_REQUEST"

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}
