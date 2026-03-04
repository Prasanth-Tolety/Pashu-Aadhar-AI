"""
Livestock ID Generator
=======================
Generates unique, sequential Livestock IDs using DynamoDB atomic counter
or an offline counter file.

ID format:  LSK-<8-digit zero-padded number>
Example:    LSK-00000001, LSK-00000002

DynamoDB approach:
    A dedicated "counter" item in the same table.
    Uses UpdateItem with ADD to guarantee atomicity.

Offline approach:
    JSON file counter in results/ folder.
"""

import os
import json
import logging
from typing import Optional

from enrollment_service.config import (
    DYNAMODB_TABLE_NAME,
    AWS_REGION,
    RESULTS_DIR,
)

logger = logging.getLogger(__name__)

try:
    import boto3
    from decimal import Decimal

    _BOTO3 = True
except ImportError:
    _BOTO3 = False

COUNTER_KEY = "__COUNTER__"
ID_PREFIX = "LSK"


class LivestockIDGenerator:
    """Generate unique livestock IDs."""

    def __init__(self, offline: bool = False):
        self.offline = offline or (not _BOTO3)
        self._table = None

        if not self.offline:
            try:
                ddb = boto3.resource("dynamodb", region_name=AWS_REGION)
                self._table = ddb.Table(DYNAMODB_TABLE_NAME)
                self._table.table_status
                logger.info("ID generator using DynamoDB atomic counter")
            except Exception as e:
                logger.warning(f"DynamoDB unavailable ({e}), using offline counter")
                self.offline = True

        if self.offline:
            self._counter_path = os.path.join(RESULTS_DIR, "id_counter.json")
            logger.info(f"Offline ID counter: {self._counter_path}")

    def generate(self) -> str:
        """Generate the next unique livestock ID."""
        if self.offline:
            seq = self._next_offline()
        else:
            seq = self._next_dynamodb()

        lid = f"{ID_PREFIX}-{seq:08d}"
        logger.info(f"Generated ID: {lid}")
        return lid

    def current(self) -> int:
        """Return the current counter value (latest issued sequence)."""
        if self.offline:
            return self._read_offline()
        return self._read_dynamodb()

    # ─── DynamoDB ────────────────────────────────────────

    def _next_dynamodb(self) -> int:
        resp = self._table.update_item(
            Key={"livestock_id": COUNTER_KEY},
            UpdateExpression="ADD seq_num :inc",
            ExpressionAttributeValues={":inc": Decimal("1")},
            ReturnValues="UPDATED_NEW",
        )
        return int(resp["Attributes"]["seq_num"])

    def _read_dynamodb(self) -> int:
        try:
            resp = self._table.get_item(Key={"livestock_id": COUNTER_KEY})
            item = resp.get("Item", {})
            return int(item.get("seq_num", 0))
        except Exception:
            return 0

    # ─── Offline ─────────────────────────────────────────

    def _next_offline(self) -> int:
        current = self._read_offline()
        new_val = current + 1
        self._write_offline(new_val)
        return new_val

    def _read_offline(self) -> int:
        if os.path.isfile(self._counter_path):
            try:
                with open(self._counter_path, "r") as f:
                    data = json.load(f)
                return data.get("seq_num", 0)
            except Exception:
                return 0
        return 0

    def _write_offline(self, val: int):
        os.makedirs(os.path.dirname(self._counter_path), exist_ok=True)
        with open(self._counter_path, "w") as f:
            json.dump({"seq_num": val}, f)
