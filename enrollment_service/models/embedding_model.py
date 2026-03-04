"""
Muzzle Embedding Model  (torchvision — SageMaker-ready)
==========================================================
Uses a pre-trained EfficientNet-B0 backbone (ImageNet weights) with a
custom 512-d embedding head. This model:

    1. Can be used locally for dev/testing  (CPU inference)
    2. Can be exported to TorchScript and deployed to SageMaker
    3. Can be fine-tuned with a triplet / ArcFace loss on cattle muzzle data

The architecture is lightweight enough for SageMaker ml.m5.large and
produces L2-normalised embeddings suitable for cosine similarity search.
"""

import io
import os
import logging
from typing import Optional

import numpy as np
import cv2

logger = logging.getLogger(__name__)

# ─── Optional torch imports (only needed for local / SageMaker inference) ───
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.info("PyTorch not installed — embedding model will use ONNX fallback only.")

from enrollment_service.config import EMBEDDING_DIMENSION


# ─────────────────────────────────────────────────────────────────────
# Model Definition
# ─────────────────────────────────────────────────────────────────────

if TORCH_AVAILABLE:

    class MuzzleEmbeddingNet(nn.Module):
        """
        EfficientNet-B0 backbone → Global Average Pool → 512-d embedding.

        Pretrained ImageNet weights give a strong starting point even
        without fine-tuning on cattle data. For production, fine-tune
        with triplet loss on muzzle-print pairs.
        """

        def __init__(self, embedding_dim: int = EMBEDDING_DIMENSION, pretrained: bool = True):
            super().__init__()

            # EfficientNet-B0 backbone (1280-d features before classifier)
            weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
            backbone = models.efficientnet_b0(weights=weights)

            # Remove the classifier head; keep features + avgpool
            self.features = backbone.features
            self.avgpool = backbone.avgpool

            # Embedding head: 1280 → 512
            self.embedding_head = nn.Sequential(
                nn.Dropout(p=0.2),
                nn.Linear(1280, embedding_dim),
                nn.BatchNorm1d(embedding_dim),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            """
            Args:
                x: (B, 3, 224, 224) normalised image tensor.

            Returns:
                (B, embedding_dim) L2-normalised embeddings.
            """
            feat = self.features(x)                        # (B, 1280, 7, 7)
            feat = self.avgpool(feat)                      # (B, 1280, 1, 1)
            feat = torch.flatten(feat, 1)                  # (B, 1280)
            emb = self.embedding_head(feat)                # (B, 512)
            emb = nn.functional.normalize(emb, p=2, dim=1) # L2 norm
            return emb

    # ─── Preprocessing transform (same as ImageNet) ───
    EMBEDDING_TRANSFORM = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])


# ─────────────────────────────────────────────────────────────────────
# High-level API
# ─────────────────────────────────────────────────────────────────────

class MuzzleEmbeddingModel:
    """
    Generate 512-d muzzle embeddings using EfficientNet-B0.

    Usage (local):
        model = MuzzleEmbeddingModel()
        emb = model.embed_image_bytes(jpeg_bytes)  # -> list[float]

    For SageMaker, use sagemaker/inference.py which loads this model.
    """

    def __init__(self, weights_path: str = None, device: str = "cpu"):
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "PyTorch is required for the embedding model. "
                "Install: pip install torch torchvision"
            )

        self.device = torch.device(device)
        self.model = MuzzleEmbeddingNet(
            embedding_dim=EMBEDDING_DIMENSION, pretrained=True
        )

        # Load fine-tuned weights if provided
        if weights_path and os.path.isfile(weights_path):
            state = torch.load(weights_path, map_location=self.device)
            self.model.load_state_dict(state)
            logger.info(f"Loaded fine-tuned weights from {weights_path}")

        self.model.to(self.device)
        self.model.eval()

    # ------------------------------------------------------------------
    def embed_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Generate embedding from a BGR numpy array (e.g. face crop).

        Returns:
            np.ndarray of shape (embedding_dim,)
        """
        # BGR → RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        tensor = EMBEDDING_TRANSFORM(rgb).unsqueeze(0).to(self.device)

        with torch.no_grad():
            emb = self.model(tensor)

        return emb.squeeze(0).cpu().numpy()

    # ------------------------------------------------------------------
    def embed_image_bytes(self, image_bytes: bytes) -> "np.ndarray | None":
        """
        Generate embedding from raw JPEG/PNG bytes.

        Returns:
            np.ndarray of shape (embedding_dim,), or None on failure.
        """
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        return self.embed_frame(img)

    # ------------------------------------------------------------------
    def export_torchscript(self, output_path: str = "muzzle_embedding.pt"):
        """
        Export the model to TorchScript for SageMaker deployment.
        """
        dummy = torch.randn(1, 3, 224, 224).to(self.device)
        scripted = torch.jit.trace(self.model, dummy)
        scripted.save(output_path)
        logger.info(f"Exported TorchScript model to {output_path}")
        return output_path
