#!/bin/bash
# ─── Create Fresh Default Users for Pashu Aadhaar AI ───
# Uses admin-create-user + admin-set-user-password to bypass SMS verification
# This creates CONFIRMED users directly

POOL_ID="us-east-1_NPYiBsfST"

echo "🧹 Creating fresh default users..."

# ─── 1. Farmer ───
echo ""
echo "Creating Farmer (+919876543210)..."
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543210" \
  --user-attributes \
    Name=phone_number,Value="+919876543210" \
    Name=phone_number_verified,Value=true \
    Name=name,Value="Raju Farmer" \
    Name=custom:role,Value="farmer" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "+919876543210" \
  --password "Farmer@123" \
  --permanent

# Get the sub for owner_id mapping
FARMER_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543210" \
  --query "UserAttributes[?Name=='sub'].Value" \
  --output text)
echo "  Farmer sub: $FARMER_SUB"

FARMER_OWNER_ID="OWN-${FARMER_SUB:0:8}"
echo "  Farmer owner_id: $FARMER_OWNER_ID"

# Set owner_id custom attribute
aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "+919876543210" \
  --user-attributes Name=custom:owner_id,Value="$FARMER_OWNER_ID"

# Create DynamoDB owner record
aws dynamodb put-item --table-name owners --item "{
  \"owner_id\": {\"S\": \"$FARMER_OWNER_ID\"},
  \"user_id\": {\"S\": \"$FARMER_SUB\"},
  \"name\": {\"S\": \"Raju Farmer\"},
  \"phone_number\": {\"S\": \"+919876543210\"},
  \"village\": {\"S\": \"Kothapalli\"},
  \"district\": {\"S\": \"Medak\"},
  \"state\": {\"S\": \"Telangana\"},
  \"pincode\": {\"S\": \"502110\"},
  \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}"

echo "  ✅ Farmer created & owner record seeded"

# ─── 2. Veterinarian ───
echo ""
echo "Creating Veterinarian (+919876543211)..."
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543211" \
  --user-attributes \
    Name=phone_number,Value="+919876543211" \
    Name=phone_number_verified,Value=true \
    Name=name,Value="Dr. Sharma" \
    Name=custom:role,Value="veterinarian" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "+919876543211" \
  --password "Vet@12345" \
  --permanent

VET_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543211" \
  --query "UserAttributes[?Name=='sub'].Value" \
  --output text)
VET_OWNER_ID="OWN-${VET_SUB:0:8}"

aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "+919876543211" \
  --user-attributes Name=custom:owner_id,Value="$VET_OWNER_ID"

aws dynamodb put-item --table-name owners --item "{
  \"owner_id\": {\"S\": \"$VET_OWNER_ID\"},
  \"user_id\": {\"S\": \"$VET_SUB\"},
  \"name\": {\"S\": \"Dr. Sharma\"},
  \"phone_number\": {\"S\": \"+919876543211\"},
  \"village\": {\"S\": \"Hyderabad\"},
  \"district\": {\"S\": \"Hyderabad\"},
  \"state\": {\"S\": \"Telangana\"},
  \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}"

echo "  ✅ Veterinarian created"

# ─── 3. Insurance Agent ───
echo ""
echo "Creating Insurance Agent (+919876543212)..."
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543212" \
  --user-attributes \
    Name=phone_number,Value="+919876543212" \
    Name=phone_number_verified,Value=true \
    Name=name,Value="Priya Insurer" \
    Name=custom:role,Value="insurer" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "+919876543212" \
  --password "Insurer@123" \
  --permanent

INS_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543212" \
  --query "UserAttributes[?Name=='sub'].Value" \
  --output text)
INS_OWNER_ID="OWN-${INS_SUB:0:8}"

aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "+919876543212" \
  --user-attributes Name=custom:owner_id,Value="$INS_OWNER_ID"

aws dynamodb put-item --table-name owners --item "{
  \"owner_id\": {\"S\": \"$INS_OWNER_ID\"},
  \"user_id\": {\"S\": \"$INS_SUB\"},
  \"name\": {\"S\": \"Priya Insurer\"},
  \"phone_number\": {\"S\": \"+919876543212\"},
  \"district\": {\"S\": \"Mumbai\"},
  \"state\": {\"S\": \"Maharashtra\"},
  \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}"

echo "  ✅ Insurance Agent created"

# ─── 4. Government Official ───
echo ""
echo "Creating Government Official (+919876543213)..."
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543213" \
  --user-attributes \
    Name=phone_number,Value="+919876543213" \
    Name=phone_number_verified,Value=true \
    Name=name,Value="AHD Officer" \
    Name=custom:role,Value="government" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "+919876543213" \
  --password "Govt@12345" \
  --permanent

GOV_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543213" \
  --query "UserAttributes[?Name=='sub'].Value" \
  --output text)
GOV_OWNER_ID="OWN-${GOV_SUB:0:8}"

aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "+919876543213" \
  --user-attributes Name=custom:owner_id,Value="$GOV_OWNER_ID"

aws dynamodb put-item --table-name owners --item "{
  \"owner_id\": {\"S\": \"$GOV_OWNER_ID\"},
  \"user_id\": {\"S\": \"$GOV_SUB\"},
  \"name\": {\"S\": \"AHD Officer\"},
  \"phone_number\": {\"S\": \"+919876543213\"},
  \"district\": {\"S\": \"New Delhi\"},
  \"state\": {\"S\": \"Delhi\"},
  \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}"

echo "  ✅ Government Official created"

# ─── 5. Administrator ───
echo ""
echo "Creating Administrator (+919876543214)..."
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543214" \
  --user-attributes \
    Name=phone_number,Value="+919876543214" \
    Name=phone_number_verified,Value=true \
    Name=name,Value="System Admin" \
    Name=custom:role,Value="admin" \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "+919876543214" \
  --password "Admin@1234" \
  --permanent

ADMIN_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "+919876543214" \
  --query "UserAttributes[?Name=='sub'].Value" \
  --output text)
ADMIN_OWNER_ID="OWN-${ADMIN_SUB:0:8}"

aws cognito-idp admin-update-user-attributes \
  --user-pool-id "$POOL_ID" \
  --username "+919876543214" \
  --user-attributes Name=custom:owner_id,Value="$ADMIN_OWNER_ID"

aws dynamodb put-item --table-name owners --item "{
  \"owner_id\": {\"S\": \"$ADMIN_OWNER_ID\"},
  \"user_id\": {\"S\": \"$ADMIN_SUB\"},
  \"name\": {\"S\": \"System Admin\"},
  \"phone_number\": {\"S\": \"+919876543214\"},
  \"district\": {\"S\": \"Hyderabad\"},
  \"state\": {\"S\": \"Telangana\"},
  \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
}"

echo "  ✅ Administrator created"

echo ""
echo "════════════════════════════════════════════"
echo "  All 5 default users created successfully!"
echo "════════════════════════════════════════════"
echo ""
aws cognito-idp list-users --user-pool-id "$POOL_ID" \
  --query "Users[].{Username:Username,Status:UserStatus,Phone:Attributes[?Name=='phone_number'].Value|[0],Name:Attributes[?Name=='name'].Value|[0],Role:Attributes[?Name=='custom:role'].Value|[0]}" \
  --output table
