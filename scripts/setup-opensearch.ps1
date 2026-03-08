# ============================================
# OpenSearch Setup Script for Pashu-Aadhaar
# ============================================

$DOMAIN_NAME = "pashu-aadhaar-embeddings"
$REGION = "us-east-1"
$ACCOUNT_ID = "011528279411"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Creating OpenSearch Domain" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will take 15-20 minutes to complete..." -ForegroundColor Yellow
Write-Host ""

# Create the domain
aws opensearch create-domain `
    --domain-name $DOMAIN_NAME `
    --engine-version "OpenSearch_2.11" `
    --cluster-config "InstanceType=t3.small.search,InstanceCount=1" `
    --ebs-options "EBSEnabled=true,VolumeType=gp3,VolumeSize=10" `
    --node-to-node-encryption-options "Enabled=true" `
    --encryption-at-rest-options "Enabled=true" `
    --domain-endpoint-options "EnforceHTTPS=true" `
    --access-policies "{`"Version`":`"2012-10-17`",`"Statement`":[{`"Effect`":`"Allow`",`"Principal`":{`"AWS`":`"arn:aws:iam::${ACCOUNT_ID}:root`"},`"Action`":`"es:*`",`"Resource`":`"arn:aws:es:${REGION}:${ACCOUNT_ID}:domain/${DOMAIN_NAME}/*`"}]}"

Write-Host ""
Write-Host "Domain creation initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "Run this command to check status:" -ForegroundColor Yellow
Write-Host "aws opensearch describe-domain --domain-name $DOMAIN_NAME --query 'DomainStatus.Processing'"
Write-Host ""
Write-Host "When Processing=false, your domain is ready!"
Write-Host ""
Write-Host "Then run: .\scripts\create-opensearch-index.ps1"
