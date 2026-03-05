"""
Custom inference script for CLIP image embedding generation.
Accepts raw image bytes (application/octet-stream) and returns
a 512-dimensional embedding vector as JSON.
"""

import io
import json
import torch
import logging
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger(__name__)

# Global model and processor (loaded once)
model = None
processor = None
device = None


def model_fn(model_dir):
    """Load CLIP model and processor from HuggingFace Hub."""
    global model, processor, device

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Loading CLIP model on device: {device}")

    model_name = "openai/clip-vit-base-patch32"
    model = CLIPModel.from_pretrained(model_name).to(device)
    model.eval()
    processor = CLIPProcessor.from_pretrained(model_name)

    logger.info("CLIP model loaded successfully")
    return model


def input_fn(request_body, content_type):
    """
    Deserialize the request body.
    Supports:
      - application/octet-stream: raw image bytes
      - application/x-image: raw image bytes
      - image/jpeg, image/png: raw image bytes
      - application/json: base64-encoded image in {"image": "<base64>"} format
    """
    if content_type in [
        "application/octet-stream",
        "application/x-image",
        "image/jpeg",
        "image/png",
        "image/webp",
    ]:
        image = Image.open(io.BytesIO(request_body)).convert("RGB")
        return image

    if content_type == "application/json":
        import base64
        data = json.loads(request_body)
        if "image" in data:
            image_bytes = base64.b64decode(data["image"])
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            return image
        raise ValueError("JSON body must contain 'image' key with base64-encoded data")

    raise ValueError(f"Unsupported content type: {content_type}")


def predict_fn(image, model):
    """Generate CLIP image embedding from the input image."""
    global processor, device

    with torch.no_grad():
        inputs = processor(images=image, return_tensors="pt").to(device)
        image_features = model.get_image_features(**inputs)

        # L2 normalize the embedding (standard for cosine similarity)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        embedding = image_features.squeeze().cpu().tolist()

    logger.info(f"Generated embedding with {len(embedding)} dimensions")
    return embedding


def output_fn(prediction, accept):
    """Serialize the embedding to JSON."""
    response = {"embedding": prediction}
    return json.dumps(response), "application/json"
