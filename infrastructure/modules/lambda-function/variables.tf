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

variable "entrypoint" {
  type        = string
  description = "Full path to Lambda function entrypoint, e.g. index.ts"
}

variable "working_directory" {
  type        = string
  description = "Typically the folder containing the package.json at the root of your Lambda project."
}
