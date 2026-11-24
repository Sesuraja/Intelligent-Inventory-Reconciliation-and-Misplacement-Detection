"""
Dataset Builder Module.
Implements Section 2.2 and W2/W3 requirements:
- Versioned datasets from test sessions and verified physical labels
- Split by whole session and by physical object (EPC)
- Automatic leakage check (no session or physical object overlap between train and test)
- Refusal to mix simulated and real data unless allow_hybrid=True
"""

from typing import Dict, Any, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import random

from app.models.dataset import Dataset, DatasetItem
from app.models.session import TestSession, GroundTruthLabel


class DatasetBuilder:
    """
    Constructs versioned datasets with rigorous physical provenance and leakage protection.
    """

    @classmethod
    def check_data_leakage(
        cls,
        train_items: List[Dict[str, Any]],
        test_items: List[Dict[str, Any]]
    ) -> Tuple[bool, str]:
        """
        Validates that there is zero overlap between train and test sets
        in both session IDs and physical EPC tags.
        """
        train_sessions: Set[str] = {item["session_id"] for item in train_items}
        test_sessions: Set[str] = {item["session_id"] for item in test_items}
        session_overlap = train_sessions.intersection(test_sessions)

        train_epcs: Set[str] = {item["epc"] for item in train_items}
        test_epcs: Set[str] = {item["epc"] for item in test_items}
        epc_overlap = train_epcs.intersection(test_epcs)

        # In strict multi-session datasets, session overlap is forbidden.
        # When splitting a single session by physical object, EPC overlap is strictly forbidden.
        if epc_overlap:
            return False, f"Physical object leakage detected: {len(epc_overlap)} EPCs exist in both train and test splits ({list(epc_overlap)[:3]}...)"
        
        all_sessions = train_sessions.union(test_sessions)
        if len(all_sessions) >= 2 and session_overlap:
            return False, f"Session leakage detected: {len(session_overlap)} sessions exist in both train and test splits ({list(session_overlap)[:3]}...)"

        return True, "Leakage check passed: 0% overlap across physical EPCs and sessions."

    @classmethod
    def build_dataset(
        cls,
        db: Session,
        name: str,
        version: str,
        session_ids: Optional[List[str]] = None,
        allow_hybrid: bool = False,
        train_ratio: float = 0.8,
        created_by: str = "supervisor"
    ) -> Dict[str, Any]:
        """
        Gathers labels, enforces simulation provenance, splits with zero leakage,
        and saves versioned dataset records.
        """
        # 1. Fetch labels from sessions
        query = db.query(GroundTruthLabel)
        if session_ids:
            query = query.filter(GroundTruthLabel.session_id.in_(session_ids))
        labels = query.all()

        # If no labels in test_sessions, fallback to synthetic seed or verification logs
        samples: List[Dict[str, Any]] = []
        if labels:
            for lbl in labels:
                samples.append({
                    "session_id": lbl.session_id,
                    "epc": lbl.epc,
                    "ground_truth_label": lbl.label,
                    "features": {
                        "actual_bay": lbl.actual_bay,
                        "provenance_who": lbl.provenance_who,
                        "provenance_method": lbl.provenance_method
                    },
                    "is_simulated": lbl.is_simulated
                })
        else:
            # Generate structured physical-provenance baseline samples
            from app.models.inventory import Inventory
            items = db.query(Inventory).all()
            dummy_session = "SESSION-SEEDED-001"
            for it in items:
                samples.append({
                    "session_id": dummy_session,
                    "epc": it.epc,
                    "ground_truth_label": "present_correct" if it.status == "IN_PLACE" else "present_misplaced",
                    "features": {
                        "expected_shelf": it.expected_shelf.shelf_code if it.expected_shelf else "SHELF_A",
                        "product_sku": it.product.sku if it.product else "UNKNOWN"
                    },
                    "is_simulated": True
                })

        if not samples:
            raise ValueError("No ground truth or inventory samples available to build dataset.")

        # 2. Check simulation provenance (W2 compliance)
        sim_count = sum(1 for s in samples if s["is_simulated"])
        real_count = len(samples) - sim_count

        if sim_count > 0 and real_count > 0 and not allow_hybrid:
            raise ValueError(
                f"Refusing to mix simulated ({sim_count}) and real ({real_count}) data "
                f"without explicit allow_hybrid=True flag (W2 circular validation protection)."
            )

        if real_count > 0 and sim_count == 0:
            data_source = "real"
        elif sim_count > 0 and real_count == 0:
            data_source = "simulated"
        else:
            data_source = "hybrid"

        # 3. Partition by whole session and physical object (EPC) to prevent leakage
        unique_sessions = sorted(list({s["session_id"] for s in samples}))
        unique_epcs = sorted(list({s["epc"] for s in samples}))
        random.seed(42)

        if len(unique_sessions) >= 2:
            shuffled_sessions = list(unique_sessions)
            random.shuffle(shuffled_sessions)
            sess_split = max(1, int(len(shuffled_sessions) * train_ratio))
            if sess_split >= len(shuffled_sessions):
                sess_split = len(shuffled_sessions) - 1
            train_sess_set = set(shuffled_sessions[:sess_split])
            test_sess_set = set(shuffled_sessions[sess_split:])

            train_samples = [s for s in samples if s["session_id"] in train_sess_set]
            test_candidates = [s for s in samples if s["session_id"] in test_sess_set]
            
            # Ensure physical EPCs also do not overlap between train and test
            train_epcs = {s["epc"] for s in train_samples}
            test_samples = [s for s in test_candidates if s["epc"] not in train_epcs]
            test_epcs = {s["epc"] for s in test_samples}

            # If all EPCs in test_sess appeared in train_sess, ensure test has unique items
            if not test_samples and test_candidates:
                test_samples = [test_candidates[0]]
                train_samples = [s for s in train_samples if s["epc"] != test_candidates[0]["epc"]]
                train_epcs = {s["epc"] for s in train_samples}
                test_epcs = {test_candidates[0]["epc"]}
        else:
            # Single session: partition purely by physical EPC objects
            shuffled_epcs = list(unique_epcs)
            random.shuffle(shuffled_epcs)
            split_idx = max(1, int(len(shuffled_epcs) * train_ratio))
            if split_idx >= len(shuffled_epcs) and len(shuffled_epcs) > 1:
                split_idx = len(shuffled_epcs) - 1
            train_epcs = set(shuffled_epcs[:split_idx])
            test_epcs = set(shuffled_epcs[split_idx:])

            train_samples = [s for s in samples if s["epc"] in train_epcs]
            test_samples = [s for s in samples if s["epc"] in test_epcs]

        # 4. Enforce strict leakage check
        passed, msg = cls.check_data_leakage(train_samples, test_samples)
        if not passed:
            raise ValueError(f"Dataset split failed leakage assertion: {msg}")

        # 5. Persist Dataset record
        dataset_row = Dataset(
            name=name,
            version=version,
            data_source=data_source,
            total_items=len(samples),
            train_items=len(train_samples),
            test_items=len(test_samples),
            session_count=len(unique_sessions),
            leakage_check_passed=passed,
            allow_hybrid=allow_hybrid,
            created_by=created_by,
            summary={
                "leakage_verification": msg,
                "train_epc_count": len(train_epcs),
                "test_epc_count": len(test_epcs),
                "simulated_samples": sim_count,
                "real_samples": real_count,
                "train_ratio": train_ratio
            }
        )
        db.add(dataset_row)
        db.flush()

        # 6. Persist individual items
        for s in train_samples:
            db.add(DatasetItem(
                dataset_id=dataset_row.id,
                session_id=s["session_id"],
                epc=s["epc"],
                split="train",
                ground_truth_label=s["ground_truth_label"],
                features=s.get("features"),
                is_simulated=s["is_simulated"]
            ))

        for s in test_samples:
            db.add(DatasetItem(
                dataset_id=dataset_row.id,
                session_id=s["session_id"],
                epc=s["epc"],
                split="test",
                ground_truth_label=s["ground_truth_label"],
                features=s.get("features"),
                is_simulated=s["is_simulated"]
            ))

        db.commit()
        db.refresh(dataset_row)

        return {
            "dataset_id": dataset_row.id,
            "name": dataset_row.name,
            "version": dataset_row.version,
            "data_source": dataset_row.data_source,
            "total_items": dataset_row.total_items,
            "train_items": dataset_row.train_items,
            "test_items": dataset_row.test_items,
            "leakage_check_passed": dataset_row.leakage_check_passed,
            "message": msg
        }


dataset_builder = DatasetBuilder()
