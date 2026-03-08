#!/bin/bash
set -e

# ==========================
# CONFIGURATION
# ==========================

AWS_REGION="us-east-1"
BUCKET_NAME="pashu-aadhaar-website-prod"
OAC_ID=E3F0P2ELZDY6HW

echo "��� Starting Secure CloudFront Deployment..."

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "✅ AWS Account ID: $AWS_ACCOUNT_ID"

# ==========================
# STEP 1: Create OAC
# ==========================

echo "��� Creating Origin Access Control..."
echo "��� Using existing OAC..."
echo "OAC ID: $OAC_ID"
#OAC_ID=$(aws cloudfront create-origin-access-control \
#  --origin-access-control-config "{
#    \"Name\": \"pashu-aadhaar-oac\",
#    \"Description\": \"OAC for Pashu-Aadhaar Website\",
#    \"SigningProtocol\": \"sigv4\",
#    \"SigningBehavior\": \"always\",
#    \"OriginAccessControlOriginType\": \"s3\"
#  }" \
#  --query 'OriginAccessControl.Id' \
#  --output text)
#
#echo "✅ OAC Created: $OAC_ID"

# ==========================
# STEP 2: Create Distribution Config
# ==========================

echo "��� Creating CloudFront config..."

cat > cloudfront-config.json << EOF
{
  "CallerReference": "pashu-aadhaar-$(date +%s)",
  "Comment": "Secure Pashu-Aadhaar Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3Origin",
        "DomainName": "${BUCKET_NAME}.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "${OAC_ID}"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3Origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "HttpVersion": "http2and3",
  "PriceClass": "PriceClass_100"
}
EOF

echo "✅ Config file ready"

# ==========================
# STEP 3: Create Distribution
# ==========================

echo "��� Creating CloudFront distribution..."

RESULT=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json)

DISTRIBUTION_ID=$(echo "$RESULT" | grep -o '"Id": "[^"]*' | head -1 | cut -d'"' -f4)
DOMAIN_NAME=$(echo "$RESULT" | grep -o '"DomainName": "[^"]*' | head -1 | cut -d'"' -f4)

echo "✅ Distribution Created"
echo "Distribution ID: $DISTRIBUTION_ID"
echo "Domain Name: $DOMAIN_NAME"

# ==========================
# STEP 4: Secure S3 Bucket
# ==========================

echo "��� Applying secure bucket policy..."

cat > s3-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket ${BUCKET_NAME} \
  --policy file://s3-policy.json

echo "✅ Bucket policy applied"

# Block public access completely
aws s3api put-public-access-block \
  --bucket ${BUCKET_NAME} \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "✅ Public access blocked"

# ==========================
# DONE
# ==========================

echo ""
echo "��� DEPLOYMENT COMPLETE!"
echo ""
echo "⏳ Wait 5-10 minutes for CloudFront to deploy."
echo ""
echo "��� Your Website URL:"
echo "https://${DOMAIN_NAME}"
echo ""
echo "Check status with:"
echo "aws cloudfront get-distribution --id ${DISTRIBUTION_ID}"
echo ""
