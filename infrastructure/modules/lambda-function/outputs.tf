output "arn" {
  value       = aws_lambda_function.this.arn
  description = "Lambda function ARN."
}

output "name" {
  value       = aws_lambda_function.this.function_name
  description = "Lambda function name."
}

output "role_id" {
  value       = aws_iam_role.this.id
  description = "IAM role this Lambda uses."
}
