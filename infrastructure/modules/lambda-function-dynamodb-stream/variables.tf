variable "function_name" {
  type        = string
  description = "Lambda function name."
}

variable "subscriptions" {
  type = map(object({
    stream_arn = string,
    batch_size = number,
  }))
  description = "Subscribe to these DynamoDB streams."
  default     = {}
}

variable "role_id" {
  type        = string
  description = "Lambda function role that we'll add extra permissions to."
}
