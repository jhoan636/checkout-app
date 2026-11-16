#!/usr/bin/env bash
# Deletes everything deploy.sh created, so nothing keeps consuming credits.
# Run it from AWS CloudShell:  bash infra/destroy.sh
set -euo pipefail

STACK=${STACK:-checkout}

BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" --output text 2>/dev/null || true)
# A bucket has to be empty before it can be deleted.
if [ -n "$BUCKET" ] && [ "$BUCKET" != None ]; then
  aws s3 rm "s3://$BUCKET" --recursive
fi

aws cloudformation delete-stack --stack-name "$STACK"
echo "Deleting the stack (the database and the distributions take several minutes)..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK"

for name in $(aws ssm get-parameters-by-path --path /checkout --recursive --query 'Parameters[].Name' --output text); do
  aws ssm delete-parameter --name "$name"
done
echo "Done. Nothing of the checkout is left in this account."
