#!/usr/bin/env bash
set -euo pipefail

# Deletes a Cognito user by email using the pool ID from SSM (/rpg/auth/userPoolId)
# Usage:
#   ./delete-cognito-user.sh <email> [region]
# Example:
#   ./delete-cognito-user.sh you@example.com us-east-1

EMAIL="${1:-}"
REGION="${2:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <email> [region]"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI not found. Please install and configure AWS CLI."
  exit 1
fi

REGION_FLAG=()
if [[ -n "$REGION" ]]; then
  REGION_FLAG=(--region "$REGION")
fi

echo "Fetching Cognito User Pool ID from SSM parameter /rpg/auth/userPoolId..."
POOL_ID="$(aws ssm get-parameter --name /rpg/auth/userPoolId --query 'Parameter.Value' --output text "${REGION_FLAG[@]}")" || {
  echo "Failed to fetch User Pool ID from SSM."; exit 1;
}

if [[ -z "$POOL_ID" || "$POOL_ID" == "None" ]]; then
  echo "Could not determine User Pool ID. Ensure /rpg/auth/userPoolId exists in SSM."
  exit 1
fi

echo "Deleting user '$EMAIL' from pool '$POOL_ID'..."
aws cognito-idp admin-delete-user --user-pool-id "$POOL_ID" --username "$EMAIL" "${REGION_FLAG[@]}"

echo "Done."


