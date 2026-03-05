"""
Deploy CLIP model to AWS SageMaker for image embedding generation.
Uses a custom inference.py that accepts raw image bytes (application/octet-stream)
and returns a 512-dimensional embedding vector.

Usage:
    python scripts/deploy_sagemaker.py
"""

import os
import sys
import time
import json
import tarfile
import tempfile
import boto3
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────
REGION = "us-east-1"
ENDPOINT_NAME = "pashu-clip-endpoint3"
MODEL_NAME = "pashu-clip-model"
ENDPOINT_CONFIG_NAME = "pashu-clip-config"
INSTANCE_TYPE = "ml.m5.large"
ROLE_ARN = "arn:aws:iam::011528279411:role/service-role/AmazonSageMaker-ExecutionRole-20260227T182566"

# HuggingFace Deep Learning Container for PyTorch inference
# See: https://github.com/aws/deep-learning-containers/blob/master/available_images.md
HF_IMAGE_URI = (
    "763104351884.dkr.ecr.us-east-1.amazonaws.com/"
    "huggingface-pytorch-inference:2.1.0-transformers4.37.0-cpu-py310-ubuntu22.04"
)

S3_BUCKET = "pashu-aadhaar-images-prod"
S3_MODEL_KEY = "sagemaker/model/clip-model.tar.gz"


def create_model_tarball():
    """
    Create a model.tar.gz containing only the code/ directory.
    The model weights are downloaded at runtime from HuggingFace Hub,
    so we only need the inference script + requirements.
    """
    script_dir = Path(__file__).parent / "sagemaker_model"
    tar_path = Path(tempfile.mkdtemp()) / "clip-model.tar.gz"

    print(f"📦 Creating model tarball from {script_dir}")
    with tarfile.open(tar_path, "w:gz") as tar:
        # Add code/inference.py
        inference_path = script_dir / "code" / "inference.py"
        tar.add(inference_path, arcname="code/inference.py")
        print(f"   Added: code/inference.py")

        # Add code/requirements.txt
        requirements_path = script_dir / "code" / "requirements.txt"
        tar.add(requirements_path, arcname="code/requirements.txt")
        print(f"   Added: code/requirements.txt")

    print(f"✅ Tarball created: {tar_path} ({tar_path.stat().st_size / 1024:.1f} KB)")
    return str(tar_path)


def upload_to_s3(local_path, bucket, key):
    """Upload the model tarball to S3."""
    s3 = boto3.client("s3", region_name=REGION)
    print(f"☁️  Uploading to s3://{bucket}/{key}")
    s3.upload_file(local_path, bucket, key)
    print(f"✅ Uploaded successfully")
    return f"s3://{bucket}/{key}"


def create_sagemaker_model(sm_client, model_data_url):
    """Create SageMaker Model resource."""
    print(f"\n🤖 Creating SageMaker Model: {MODEL_NAME}")

    # Delete if exists
    try:
        sm_client.delete_model(ModelName=MODEL_NAME)
        print(f"   Deleted existing model: {MODEL_NAME}")
    except sm_client.exceptions.ClientError:
        pass

    sm_client.create_model(
        ModelName=MODEL_NAME,
        PrimaryContainer={
            "Image": HF_IMAGE_URI,
            "ModelDataUrl": model_data_url,
            "Environment": {
                "HF_MODEL_ID": "openai/clip-vit-base-patch32",
                "HF_TASK": "feature-extraction",
                "SAGEMAKER_PROGRAM": "inference.py",
                "SAGEMAKER_SUBMIT_DIRECTORY": model_data_url,
            },
        },
        ExecutionRoleArn=ROLE_ARN,
    )
    print(f"✅ Model created")


def create_endpoint_config(sm_client):
    """Create SageMaker Endpoint Configuration."""
    print(f"\n⚙️  Creating Endpoint Config: {ENDPOINT_CONFIG_NAME}")

    # Delete if exists
    try:
        sm_client.delete_endpoint_config(EndpointConfigName=ENDPOINT_CONFIG_NAME)
        print(f"   Deleted existing config: {ENDPOINT_CONFIG_NAME}")
    except sm_client.exceptions.ClientError:
        pass

    sm_client.create_endpoint_config(
        EndpointConfigName=ENDPOINT_CONFIG_NAME,
        ProductionVariants=[
            {
                "VariantName": "AllTraffic",
                "ModelName": MODEL_NAME,
                "InstanceType": INSTANCE_TYPE,
                "InitialInstanceCount": 1,
                "InitialVariantWeight": 1.0,
            }
        ],
    )
    print(f"✅ Endpoint config created")


def create_endpoint(sm_client):
    """Create and wait for SageMaker Endpoint."""
    print(f"\n🚀 Creating Endpoint: {ENDPOINT_NAME}")

    sm_client.create_endpoint(
        EndpointName=ENDPOINT_NAME,
        EndpointConfigName=ENDPOINT_CONFIG_NAME,
    )

    print("⏳ Waiting for endpoint to be InService (this takes ~5-10 minutes)...")
    while True:
        resp = sm_client.describe_endpoint(EndpointName=ENDPOINT_NAME)
        status = resp["EndpointStatus"]
        print(f"   Status: {status}")

        if status == "InService":
            print(f"\n🎉 Endpoint is LIVE: {ENDPOINT_NAME}")
            return True
        elif status == "Failed":
            reason = resp.get("FailureReason", "Unknown")
            print(f"\n❌ Endpoint creation FAILED: {reason}")
            return False

        time.sleep(30)


def test_endpoint(endpoint_name):
    """Test the endpoint with a sample image."""
    print(f"\n🧪 Testing endpoint: {endpoint_name}")

    runtime = boto3.client("sagemaker-runtime", region_name=REGION)

    # Create a simple test image (red square)
    from PIL import Image
    import io

    img = Image.new("RGB", (224, 224), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    image_bytes = buf.getvalue()

    print(f"   Sending {len(image_bytes)} bytes as application/octet-stream...")
    response = runtime.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="application/octet-stream",
        Accept="application/json",
        Body=image_bytes,
    )

    result = json.loads(response["Body"].read().decode("utf-8"))

    if "embedding" in result:
        emb = result["embedding"]
        print(f"✅ Got embedding with {len(emb)} dimensions")
        print(f"   First 5 values: {emb[:5]}")
        print(f"   Norm: {sum(v**2 for v in emb)**0.5:.4f} (should be ~1.0)")
        return True
    else:
        print(f"❌ Unexpected response: {result}")
        return False


def main():
    sm_client = boto3.client("sagemaker", region_name=REGION)

    # Step 1: Create model tarball
    tar_path = create_model_tarball()

    # Step 2: Upload to S3
    model_data_url = upload_to_s3(tar_path, S3_BUCKET, S3_MODEL_KEY)

    # Step 3: Create SageMaker Model
    create_sagemaker_model(sm_client, model_data_url)

    # Step 4: Create Endpoint Config
    create_endpoint_config(sm_client)

    # Step 5: Create & wait for Endpoint
    success = create_endpoint(sm_client)

    if success:
        # Step 6: Test the endpoint
        test_endpoint(ENDPOINT_NAME)

        print(f"\n{'='*60}")
        print(f"📋 SUMMARY")
        print(f"{'='*60}")
        print(f"  Endpoint Name : {ENDPOINT_NAME}")
        print(f"  Instance Type : {INSTANCE_TYPE}")
        print(f"  Region        : {REGION}")
        print(f"  Content-Type  : application/octet-stream")
        print(f"  Response      : {{'embedding': [512 floats]}}")
        print(f"\n  Update samconfig.toml SageMakerEndpointName to: {ENDPOINT_NAME}")
    else:
        print("\n⚠️  Endpoint creation failed. Check CloudWatch logs for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
