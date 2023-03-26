variable "prefix" {
  type        = string
  description = "Used to form resource names."
  default     = "auto-access-rem"
}

variable "lambdas" {
  type = map(object({
    s3_key           = string
    source_code_hash = string
  }))
  description = "Lambda function code after packaging."
}

variable "identity_store_id" {
  type        = string
  description = "The directory attached to Identity Center."
}
