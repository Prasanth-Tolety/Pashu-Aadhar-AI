#!/bin/bash
set -e

# ===============================
# CONFIGURATION
# ===============================

AWS_REGION="us-east-1"
WEBSITE_BUCKET="pashu-aadhaar-website-prod"

# ��� IMPORTANT: Put your CloudFront Distribution ID here
DISTRIBUTION_ID="E2LGR4QQNGTAP0"

echo "��� Deploying frontend to S3 + CloudFront..."

# ===============================
# STEP 1: Build Frontend
# ===============================

cd frontend

if [ ! -d "dist" ]; then
  echo "��� Building frontend..."
  npm run build
fi

# ===============================
# STEP 2: Upload Static Assets (long cache)
# ===============================

echo "⬆️ Uploading static assets..."

aws s3 sync dist/ s3://$WEBSITE_BUCKET/ \
  --region $AWS_REGION \
  --delete \
  --exclude "index.html" \
  --cache-control "max-age=31536000,public"

# ===============================
# STEP 3: Upload index.html (no cache)
# ===============================

echo "⬆️ Uploading index.html (no cache)..."

aws s3 cp dist/index.html s3://$WEBSITE_BUCKET/index.html \
  --region $AWS_REGION \
  --cache-control "max-age=0,must-revalidate" \
  --content-type "text/html"

# ===============================
# STEP 4: Invalidate CloudFront Cache
# ===============================

echo "��� Invalidating CloudFront cache..."

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "��� Your website:"
echo "https://$(aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.DomainName' \
  --output text)"
echo ""
echo "⏳ Invalidation takes 1–2 minutes."
