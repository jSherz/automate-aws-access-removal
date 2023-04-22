variable "prefix" {
  type        = string
  description = "Used to form resource names."
  default     = "auto-access-rem"
}

variable "identity_store_id" {
  type        = string
  description = "The directory attached to Identity Center."
}
