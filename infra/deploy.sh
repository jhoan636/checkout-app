#!/usr/bin/env bash
# Creates or updates everything in AWS and publishes the web app.
# Run it from AWS CloudShell, inside a clone of this repository:
#   bash infra/deploy.sh
set -euo pipefail

STACK=${STACK:-checkout}
GIT_REF=${GIT_REF:-main}
PREFIX=/checkout/gateway
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOSITORY_URL=$(git -C "$ROOT" remote get-url origin)

# --- 1. Configuration of the payment gateway --------------------------------
# Typed once and stored in Parameter Store. The secrets are encrypted, and
# what is typed is neither shown nor saved in the history of the shell.
exists() { aws ssm get-parameter --name "$1" >/dev/null 2>&1; }
ask() { # name, type, prompt, hidden?
  if exists "$1"; then return; fi
  local value
  if [ "${4:-}" = hidden ]; then read -rsp "$3: " value; echo; else read -rp "$3: " value; fi
  aws ssm put-parameter --name "$1" --type "$2" --value "$value" >/dev/null
}
ask "$PREFIX/GATEWAY_BASE_URL" String "Gateway sandbox URL (https://.../v1)"
ask "$PREFIX/GATEWAY_PRIVATE_KEY" SecureString "Gateway private key" hidden
ask "$PREFIX/GATEWAY_INTEGRITY_SECRET" SecureString "Gateway integrity secret" hidden
ask "$PREFIX/GATEWAY_EVENTS_SECRET" SecureString "Gateway events secret" hidden
ask /checkout/web/GATEWAY_PUBLIC_KEY String "Gateway PUBLIC key (the one for the browser)"

parameter() { aws ssm get-parameter --name "$1" --query Parameter.Value --output text; }
GATEWAY_URL=$(parameter "$PREFIX/GATEWAY_BASE_URL")
GATEWAY_HOST=$(echo "$GATEWAY_URL" | sed -E 's#^https://([^/]+).*#\1#')

# --- 2. The network that already exists in the account ----------------------
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" Name=default-for-az,Values=true \
  --query 'sort_by(Subnets,&AvailabilityZone)[].SubnetId' --output text | tr '\t' ',')
PREFIX_LIST=$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)

# --- 3. The stack ------------------------------------------------------------
aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file "$ROOT/infra/template.yml" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "VpcId=$VPC_ID" "SubnetIds=$SUBNET_IDS" "CloudFrontPrefixListId=$PREFIX_LIST" \
    "RepositoryUrl=$REPOSITORY_URL" "GitRef=$GIT_REF" "GatewayHost=$GATEWAY_HOST"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
WEB_URL=$(output WebUrl)
API_URL=$(output ApiUrl)
BUCKET=$(output WebBucketName)

# --- 4. The web app ----------------------------------------------------------
cd "$ROOT/web"
npm ci
VITE_API_URL="$API_URL" VITE_GATEWAY_URL="$GATEWAY_URL" \
  VITE_GATEWAY_PUBLIC_KEY="$(parameter /checkout/web/GATEWAY_PUBLIC_KEY)" npm run build
# Files with a hash in their name never change; the page itself is always fresh.
aws s3 sync dist "s3://$BUCKET" --delete --exclude index.html \
  --cache-control 'public,max-age=31536000,immutable'
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id "$(output WebDistributionId)" --paths '/*' >/dev/null

# --- 5. The API ---------------------------------------------------------------
wait_for_api() {
  for _ in $(seq 1 60); do
    if curl -fsS "$API_URL/health" >/dev/null 2>&1; then return 0; fi
    sleep 15
  done
  return 1
}
# The first start compiles the API on the instance: wait for it.
echo "Waiting for the API..."
wait_for_api

# The instance builds the API only on its first start. On a later deployment
# it is asked to fetch the new code, rebuild the image and restart; it does
# nothing when it already runs that commit.
INSTANCE=$(output ApiInstanceId)
UPDATE=$(mktemp)
cat > "$UPDATE" <<JSON
{"commands": [
  "set -e",
  "export HOME=/root",
  "cd /opt/checkout",
  "git fetch -q --depth 1 origin '$GIT_REF'",
  "if [ \"\$(git rev-parse HEAD)\" != \"\$(git rev-parse FETCH_HEAD)\" ]; then git checkout -q FETCH_HEAD; docker build -q -t checkout-api api; systemctl restart checkout-api; fi",
  "git log -1 --format=%h"
]}
JSON
COMMAND=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
  --parameters "file://$UPDATE" --query Command.CommandId --output text)
echo "Updating the API on $INSTANCE..."
invocation() {
  aws ssm get-command-invocation --command-id "$COMMAND" --instance-id "$INSTANCE" --query "$1" --output text
}
for _ in $(seq 1 60); do
  STATUS=$(invocation Status 2>/dev/null || echo Pending)
  case "$STATUS" in Success | Failed | Cancelled | TimedOut) break ;; esac
  sleep 10
done
echo "API on commit $(invocation StandardOutputContent | tr -d '[:space:]'): $STATUS"
wait_for_api
curl -fsS "$API_URL/health" && echo

echo "Web:     $WEB_URL"
echo "API:     $API_URL"
echo "Swagger: $API_URL/docs"
