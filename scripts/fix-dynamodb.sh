#!/bin/bash
# Fix DynamoDB owners table - update missing roles
# Fix user_role_mapping table - populate it

REGION="us-east-1"

echo "=== Fixing owners table roles ==="

# Update each owner with missing role
declare -A OWNER_ROLES
OWNER_ROLES["OWN-94d84468"]="insurer"
OWNER_ROLES["OWN-948844e8"]="government"
OWNER_ROLES["OWN-74089418"]="farmer"
OWNER_ROLES["OWN-f438f408"]="veterinarian"
OWNER_ROLES["OWN-74186458"]="admin"
OWNER_ROLES["OWN-d4486428"]="administrator"

for owner_id in "${!OWNER_ROLES[@]}"; do
  role="${OWNER_ROLES[$owner_id]}"
  echo "  Setting role=$role for $owner_id"
  aws dynamodb update-item \
    --table-name owners \
    --key "{\"owner_id\":{\"S\":\"$owner_id\"}}" \
    --update-expression "SET #r = :r" \
    --expression-attribute-names '{"#r":"role"}' \
    --expression-attribute-values "{\":r\":{\"S\":\"$role\"}}" \
    --region $REGION
done

# Delete duplicate Prasanth entry with wrong owner_id format
echo ""
echo "=== Deleting duplicate Prasanth entry ==="
aws dynamodb delete-item \
  --table-name owners \
  --key '{"owner_id":{"S":"d4486428-00a1-70ae-62de-85e58b10f4e0"}}' \
  --region $REGION
echo "  Deleted owner_id=d4486428-00a1-70ae-62de-85e58b10f4e0"

# Create Madhav's owner record
echo ""
echo "=== Creating Madhav's owner record ==="
aws dynamodb put-item \
  --table-name owners \
  --item '{
    "owner_id": {"S": "OWN-4488d4b8"},
    "user_id": {"S": "4488d4b8-60d1-7090-23d3-9342174a7f0b"},
    "phone_number": {"S": "+919491588654"},
    "name": {"S": "Madhav"},
    "role": {"S": "admin"},
    "created_at": {"S": "2026-03-06T18:00:00Z"}
  }' \
  --region $REGION

# Update Madhav's Cognito custom:owner_id
echo ""
echo "=== Updating Madhav's Cognito owner_id ==="
aws cognito-idp admin-update-user-attributes \
  --user-pool-id us-east-1_NPYiBsfST \
  --username "4488d4b8-60d1-7090-23d3-9342174a7f0b" \
  --user-attributes Name=custom:owner_id,Value=OWN-4488d4b8 \
  --region $REGION

echo ""
echo "=== Populating user_role_mapping table ==="

# Add role mappings for all users
declare -A USER_MAPPING
USER_MAPPING["MAP-74089418"]='{"mapping_id":{"S":"MAP-74089418"},"user_id":{"S":"74089418-e0e1-7042-f8f9-5c1df9bfcde5"},"role":{"S":"farmer"},"owner_id":{"S":"OWN-74089418"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-f438f408"]='{"mapping_id":{"S":"MAP-f438f408"},"user_id":{"S":"f438f408-a021-7005-6596-ae904f804cfd"},"role":{"S":"veterinarian"},"owner_id":{"S":"OWN-f438f408"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-94d84468"]='{"mapping_id":{"S":"MAP-94d84468"},"user_id":{"S":"94d84468-b0f1-702b-3e2d-952b2b8b0be3"},"role":{"S":"insurer"},"owner_id":{"S":"OWN-94d84468"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-948844e8"]='{"mapping_id":{"S":"MAP-948844e8"},"user_id":{"S":"948844e8-60f1-708d-6a0d-84bee4c9d988"},"role":{"S":"government"},"owner_id":{"S":"OWN-948844e8"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-74186458"]='{"mapping_id":{"S":"MAP-74186458"},"user_id":{"S":"74186458-8061-7099-8fd7-7568ea5a522d"},"role":{"S":"admin"},"owner_id":{"S":"OWN-74186458"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-d4486428"]='{"mapping_id":{"S":"MAP-d4486428"},"user_id":{"S":"d4486428-00a1-70ae-62de-85e58b10f4e0"},"role":{"S":"administrator"},"owner_id":{"S":"OWN-d4486428"},"created_at":{"S":"2026-03-05T19:47:53Z"}}'
USER_MAPPING["MAP-4488d4b8"]='{"mapping_id":{"S":"MAP-4488d4b8"},"user_id":{"S":"4488d4b8-60d1-7090-23d3-9342174a7f0b"},"role":{"S":"admin"},"owner_id":{"S":"OWN-4488d4b8"},"created_at":{"S":"2026-03-06T18:00:00Z"}}'

for mapping_id in "${!USER_MAPPING[@]}"; do
  item="${USER_MAPPING[$mapping_id]}"
  echo "  Adding $mapping_id"
  aws dynamodb put-item \
    --table-name user_role_mapping \
    --item "$item" \
    --region $REGION
done

echo ""
echo "=== Verification ==="
echo "--- Owners ---"
aws dynamodb scan --table-name owners --region $REGION --query "Items[*].{owner_id:owner_id.S, name:name.S, role:role.S}" --output table

echo ""
echo "--- User Role Mapping ---"
aws dynamodb scan --table-name user_role_mapping --region $REGION --query "Items[*].{mapping_id:mapping_id.S, user_id:user_id.S, role:role.S}" --output table

echo ""
echo "✅ All DynamoDB fixes complete!"
