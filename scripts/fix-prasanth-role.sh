#!/bin/bash
# Fix Prasanth's role from administrator to admin
aws dynamodb update-item \
  --table-name owners \
  --key '{"owner_id":{"S":"OWN-d4486428"}}' \
  --update-expression "SET #r = :r" \
  --expression-attribute-names '{"#r":"role"}' \
  --expression-attribute-values '{":r":{"S":"admin"}}' \
  --region us-east-1

# Also fix the role mapping
aws dynamodb update-item \
  --table-name user_role_mapping \
  --key '{"mapping_id":{"S":"MAP-d4486428"}}' \
  --update-expression "SET #r = :r" \
  --expression-attribute-names '{"#r":"role"}' \
  --expression-attribute-values '{":r":{"S":"admin"}}' \
  --region us-east-1

echo "Done - Prasanth role fixed to admin"
