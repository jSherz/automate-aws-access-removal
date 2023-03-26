variable "name" {
  type        = string
  description = "Lambda function name."
}

variable "description" {
  type        = string
  description = "Describe what the Lambda function does."
}

variable "memory_size" {
  type        = number
  description = "How much RAM should be allocated to the function?"
  default     = 256
}

variable "s3_bucket" {
  type        = string
  description = "Bucket containing the zipped Lambda package."
}

variable "s3_key" {
  type        = string
  description = "Zipped Lambda package file in var.s3_bucket."
}

variable "source_code_hash" {
  type        = string
  description = "Hash of the zipped Lambda package in var.s3_key."
}

variable "iam_policy" {
  type        = string
  description = "IAM policy to attach to the function."
}

variable "event_rule_arns" {
  type        = map(string)
  description = "A map of any key value to EventBridge event rule ARNs that can trigger this Lambda."
  default     = {}
}

variable "reserved_concurrent_executions" {
  type        = number
  description = "Limit Lambda concurrency."
  default     = null
}

variable "env_vars" {
  type        = map(string)
  description = "Environment variables for the function."
  default     = {}
}
