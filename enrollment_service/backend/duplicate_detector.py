"""
Duplicate Detection Service
============================
Compares a new muzzle embedding against all stored embeddings in DynamoDB
to detect duplicate animals before enrollment.

Strategy:
    1. Retrieve stored embeddings from DynamoDB
    2. Compute cosine similarity with the new embedding
    3. Flag as duplicate if similarity > threshold

Offline mode: Uses a local JSON cache for development / no-internet.
"""

import os
import json
import logging
from typing import Optional, List, Dict

import numpy as np

from enrollment_service.config import (
    DYNAMODB_TABLE_NAME,
    AWS_REGION,
    DUPLICATE_THRESHOLD,
    EMBEDDING_DIMENSION,
    RESULTS_DIR,
)

logger = logging.getLogger(__name__)

try:
    import boto3
    from boto3.dynamodb.conditions import Attr
    from decimal import Decimal

    _BOTO3 = True
except ImportError:
    _BOTO3 = False


class DuplicateDetector:
    """Detect duplicate animals by comparing muzzle embeddings."""

    def __init__(self, threshold: float = None, offline: bool = False):
        self.threshold = threshold or DUPLICATE_THRESHOLD
        self.offline = offline or (not _BOTO3)
        self._table = None

        if not self.offline:
            try:
                ddb = boto3.resource("dynamodb", region_name=AWS_REGION)
                self._table = ddb.Table(DYNAMODB_TABLE_NAME)
                # Quick check
                self._table.table_status
                logger.info(f"DynamoDB connected: {DYNAMODB_TABLE_NAME}")
            except Exception as e:
                logger.warning(f"DynamoDB unavailable ({e}), using offline cache")
                self.offline = True

        if self.offline:
            self._cache_path = os.path.join(RESULTS_DIR, "embedding_cache.json")
            self._cache = self._load_cache()
            logger.info(f"Offline duplicate cache: {self._cache_path}")

    # ─── public API ──────────────────────────────────────

    def check_duplicate(
        self, embedding: np.ndarray, exclude_id: str = None
    ) -> Dict:
        """
        Check if an embedding matches any existing animal.

        Returns:
            {
                "is_duplicate": bool,
                "match_id":     str or None,
                "similarity":   float,
                "top_matches":  [{"id": str, "similarity": float}, ...]
            }
        """
        stored = self._get_all_embeddings()
        if not stored:
            return {
                "is_duplicate": False,
                "match_id": None,
                "similarity": 0.0,
                "top_matches": [],
            }

        results = []
        for record in stored:
            rid = record["livestock_id"]
            if rid == exclude_id:
                continue
            emb = np.array(record["embedding"], dtype=np.float32)
            sim = self._cosine_similarity(embedding, emb)
            results.append({"id": rid, "similarity": float(sim)})

        results.sort(key=lambda x: x["similarity"], reverse=True)
        top = results[:5]

        best = top[0] if top else {"id": None, "similarity": 0.0}
        is_dup = best["similarity"] >= self.threshold

        return {
            "is_duplicate": is_dup,
            "match_id": best["id"] if is_dup else None,
            "similarity": best["similarity"],
            "top_matches": top,
        }

    def store_embedding(self, livestock_id: str, embedding: np.ndarray):
        """Store a new embedding (used after enrollment)."""
        emb_list = embedding.tolist()
        if self.offline:
            self._cache[livestock_id] = emb_list
            self._save_cache()
        else:
            self._put_dynamodb(livestock_id, emb_list)

    # ─── retrieval ───────────────────────────────────────

    def _get_all_embeddings(self) -> List[Dict]:
        """Retrieve all livestock_id + embedding pairs."""
        if self.offline:
            return [
                {"livestock_id": k, "embedding": v}
                for k, v in self._cache.items()
            ]
        return self._scan_dynamodb()

    def _scan_dynamodb(self) -> List[Dict]:
        """Scan DynamoDB for all embeddings. Paginated."""
        records = []
        try:
            kwargs = {
                "ProjectionExpression": "livestock_id, embedding",
            }
            while True:
                resp = self._table.scan(**kwargs)
                for item in resp.get("Items", []):
                    emb = item.get("embedding")
                    if emb is None:
                        continue
                    # DynamoDB stores numbers as Decimal
                    emb_floats = [float(v) for v in emb]
                    records.append({
                        "livestock_id": item["livestock_id"],
                        "embedding": emb_floats,
                    })
                lek = resp.get("LastEvaluatedKey")
                if not lek:
                    break
                kwargs["ExclusiveStartKey"] = lek
        except Exception as e:
            logger.error(f"DynamoDB scan error: {e}")
        return records

    def _put_dynamodb(self, livestock_id: str, emb_list: list):
        """Write embedding to DynamoDB."""
        try:
            emb_decimal = [Decimal(str(round(v, 8))) for v in emb_list]
            self._table.update_item(
                Key={"livestock_id": livestock_id},
                UpdateExpression="SET embedding = :e",
                ExpressionAttributeValues={":e": emb_decimal},
            )
            logger.info(f"Stored embedding for {livestock_id}")
        except Exception as e:
            logger.error(f"DynamoDB put error: {e}")

    # ─── offline cache ───────────────────────────────────

    def _load_cache(self) -> dict:
        if os.path.isfile(self._cache_path):
            try:
                with open(self._cache_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_cache(self):
        os.makedirs(os.path.dirname(self._cache_path), exist_ok=True)
        with open(self._cache_path, "w") as f:
            json.dump(self._cache, f)

    # ─── math ────────────────────────────────────────────

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        a = a.flatten().astype(np.float64)
        b = b.flatten().astype(np.float64)
        dot = np.dot(a, b)
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 0.0
        return float(dot / (na * nb))
