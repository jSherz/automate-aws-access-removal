locals {
  # NB: changes to the name or description will overwrite the policy with a dummy one
  excluded_users_scp = {
    name        = "excluded-users"
    description = "Automatically updated SCP which blocks recently deleted or deactivated Identity Center users."
  }
}
