terraform {
  required_version = "~> 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.60"
    }
    node-lambda-packager = {
      source  = "jSherz/node-lambda-packager"
      version = "1.0.0"
    }
  }
}
