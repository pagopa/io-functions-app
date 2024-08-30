locals {
  prefix    = "io"
  env_short = "p"
  env       = "prod"
  domain    = "functions-app"

  repo_name = "io-functions-app"

  tags = {
    CostCenter  = "TS310 - PAGAMENTI & SERVIZI"
    CreatedBy   = "Terraform"
    Environment = "Prod"
    Owner       = "IO"
    Source      = "https://github.com/pagopa/io-functions-app"
  }
}
