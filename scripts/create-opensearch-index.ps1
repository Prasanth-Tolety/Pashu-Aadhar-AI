# ============================================
# Create OpenSearch Index with Vector Mapping
# ============================================
# Run this AFTER the OpenSearch domain is ready
# ============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$OpenSearchEndpoint = ""
)

$DOMAIN_NAME = "pashu-aadhaar-embeddings"
$INDEX_NAME = "livestock-embeddings"

# Get endpoint if not provided
if ([string]::IsNullOrEmpty($OpenSearchEndpoint)) {
    Write-Host "Getting OpenSearch endpoint..." -ForegroundColor Cyan
    $domainInfo = aws opensearch describe-domain --domain-name $DOMAIN_NAME | ConvertFrom-Json
    $OpenSearchEndpoint = "https://" + $domainInfo.DomainStatus.Endpoint
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating OpenSearch Index" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint: $OpenSearchEndpoint" -ForegroundColor Yellow
Write-Host "Index: $INDEX_NAME" -ForegroundColor Yellow
Write-Host ""

# Index mapping for vector search (k-NN)
# Embedding dimension = 512 (CLIP ViT-B/32) or 768 (CLIP ViT-L/14)
# Using 512 as default - adjust if your model differs

$indexMapping = @"
{
  "settings": {
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 100
    },
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "livestock_id": {
        "type": "keyword"
      },
      "embedding": {
        "type": "knn_vector",
        "dimension": 512,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil",
          "engine": "nmslib",
          "parameters": {
            "ef_construction": 128,
            "m": 24
          }
        }
      },
      "image_key": {
        "type": "keyword"
      },
      "owner_name": {
        "type": "text"
      },
      "owner_contact": {
        "type": "keyword"
      },
      "animal_type": {
        "type": "keyword"
      },
      "breed": {
        "type": "keyword"
      },
      "district": {
        "type": "keyword"
      },
      "enrolled_at": {
        "type": "date"
      },
      "status": {
        "type": "keyword"
      }
    }
  }
}
"@

# Save mapping to temp file for curl
$tempFile = [System.IO.Path]::GetTempFileName()
$indexMapping | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "Creating index with vector mapping..." -ForegroundColor Cyan

# Create the index using AWS CLI with sigv4 signing
# Note: Using curl with AWS credentials

try {
    # Method 1: Using curl with AWS SigV4 (requires curl with aws-sigv4 support)
    $url = "$OpenSearchEndpoint/$INDEX_NAME"
    
    # Get AWS credentials
    $credentials = aws sts get-caller-identity | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "Attempting to create index..." -ForegroundColor Yellow
    
    # Use Invoke-WebRequest with AWS Signature
    $body = $indexMapping
    
    # For OpenSearch with IAM auth, we need to sign the request
    # Using aws CLI to make signed HTTP request
    aws opensearch-serverless batch-get-collection 2>$null
    
    # Alternative: Use the awscurl tool or make request via Lambda
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "MANUAL STEP REQUIRED" -ForegroundColor Green  
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Go to AWS Console -> OpenSearch -> Your Domain -> Dev Tools" -ForegroundColor Yellow
    Write-Host "And run this command:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "PUT /livestock-embeddings" -ForegroundColor Cyan
    Write-Host $indexMapping -ForegroundColor White
    Write-Host ""
    Write-Host "Or use the AWS Console to create the index."
    Write-Host ""
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Clean up
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Index Configuration Summary" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Index Name: $INDEX_NAME"
Write-Host "Vector Field: embedding"
Write-Host "Dimensions: 512 (CLIP ViT-B/32)"
Write-Host "Algorithm: HNSW"
Write-Host "Similarity: Cosine Similarity"
Write-Host ""
Write-Host "Fields stored:"
Write-Host "  - livestock_id (unique animal ID)"
Write-Host "  - embedding (512-dim vector)"
Write-Host "  - image_key (S3 path)"
Write-Host "  - owner_name, owner_contact"
Write-Host "  - animal_type, breed"
Write-Host "  - district"
Write-Host "  - enrolled_at"
Write-Host "  - status (active/lost/found)"
