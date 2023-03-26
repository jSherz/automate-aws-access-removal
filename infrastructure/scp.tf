resource "aws_organizations_policy" "excluded_users_scp" {
  name        = local.excluded_users_scp.name
  description = local.excluded_users_scp.description

  content = jsonencode({
    Version : "2012-10-17",
    Statement : [
      // See https://aws.amazon.com/blogs/security/how-to-revoke-federated-users-active-aws-sessions/
      {
        "Version" : "2012-10-17",
        "Statement" : [
          {
            "Effect" : "Deny",
            "Action" : "*",
            "Resource" : "*",
            "Condition" : {
              "StringLike" : {
                "aws:userid" : [
                  "*:JohnDoe@example.com",
                  "*:MaryMajor@example.com"
                ]
              }
            }
          },
          {
            "Effect" : "Deny",
            "Action" : "*",
            "Resource" : "*",
            "Condition" : {
              "StringEquals" : {
                "aws:SourceIdentity" : [
                  "JohnDoe@example.com",
                  "MaryMajor@example.com"
                ]
              }
            }
          }
        ]
      }
    ],
  })

  # This policy is updated by the excluded-users-listener Lambda
  lifecycle {
    ignore_changes = [content]
  }
}

# TODO: attach the above policy to the relevant organization unit(s)
#resource "aws_organizations_policy_attachment" "" {
#  policy_id = ""
#  target_id = ""
#}
