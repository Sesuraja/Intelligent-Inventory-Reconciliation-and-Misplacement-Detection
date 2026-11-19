import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

class FeatureEngine:
    """
    Time-window feature extraction pipeline.
    Aggregates raw RFID observations across 5-10 second intervals per EPC.
    """

    @classmethod
    def extract_epc_features(
        cls,
        epc: str,
        expected_shelf_code: str,
        events: List[Dict[str, Any]],
        reader_online: bool = True,
        recent_movement_authorized: Optional[bool] = None,
        packaging_class: str = "CARDBOARD"
    ) -> Dict[str, Any]:
        """
        Extracts multi-antenna read counts, RSSI statistics, temporal dynamics,
        and operational context for ML inference.
        """
        now = datetime.now(timezone.utc)
        
        # Per-antenna stats (1 to 4 ports)
        ant_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        ant_rssis = {1: [], 2: [], 3: [], 4: []}
        all_rssis = []
        observed_times = []

        for evt in events:
            if evt.get("epc") != epc:
                continue
            ant_id = evt.get("antenna_port") or evt.get("antenna_id", 1)
            # map antenna_id (1-4)
            ant_idx = int(ant_id) if int(ant_id) in [1, 2, 3, 4] else 1
            rssi = float(evt.get("rssi_dbm", -80.0))
            
            ant_counts[ant_idx] += 1
            ant_rssis[ant_idx].append(rssi)
            all_rssis.append(rssi)

            obs_t = evt.get("observed_at")
            if isinstance(obs_t, str):
                try:
                    obs_t = datetime.fromisoformat(obs_t.replace("Z", "+00:00"))
                except Exception:
                    obs_t = now
            if isinstance(obs_t, datetime):
                observed_times.append(obs_t)

        total_reads = sum(ant_counts.values())

        # Medians and variance
        ant_medians = {}
        for port in [1, 2, 3, 4]:
            if ant_rssis[port]:
                ant_medians[port] = float(np.median(ant_rssis[port]))
            else:
                ant_medians[port] = -99.0  # Sentinel for no detection

        rssi_variance = float(np.var(all_rssis)) if len(all_rssis) > 1 else 0.0
        global_median_rssi = float(np.median(all_rssis)) if all_rssis else -99.0

        if observed_times:
            observed_times.sort()
            first_seen_seconds = (now - observed_times[0]).total_seconds()
            last_seen_seconds = (now - observed_times[-1]).total_seconds()
        else:
            first_seen_seconds = 9999.0
            last_seen_seconds = 9999.0

        # Packaging risk numeric
        pkg_map = {
            "CARDBOARD": 0.0,
            "PLASTIC": 0.1,
            "LIQUID_PROXIMITY": 0.5,
            "METAL_SHIELDED": 0.8
        }
        packaging_numeric = pkg_map.get(packaging_class.upper(), 0.0)

        # Movement indicator
        movement_flag = 1.0 if (recent_movement_authorized is True) else (-1.0 if (recent_movement_authorized is False) else 0.0)

        # Primary detecting antenna
        primary_port = max(ant_counts, key=lambda k: ant_counts[k]) if total_reads > 0 else 0

        features = {
            "epc": epc,
            "expected_shelf": expected_shelf_code,
            "total_reads": total_reads,
            "ant_1_reads": ant_counts[1],
            "ant_2_reads": ant_counts[2],
            "ant_3_reads": ant_counts[3],
            "ant_4_reads": ant_counts[4],
            "ant_1_rssi_med": ant_medians[1],
            "ant_2_rssi_med": ant_medians[2],
            "ant_3_rssi_med": ant_medians[3],
            "ant_4_rssi_med": ant_medians[4],
            "global_median_rssi": global_median_rssi,
            "rssi_variance": rssi_variance,
            "last_seen_seconds": max(0.0, last_seen_seconds),
            "first_seen_seconds": max(0.0, first_seen_seconds),
            "reader_health": 1.0 if reader_online else 0.0,
            "movement_flag": movement_flag,
            "packaging_risk": packaging_numeric,
            "primary_antenna_port": primary_port
        }
        return features

    @classmethod
    def to_feature_vector(cls, features: Dict[str, Any]) -> List[float]:
        """Convert feature dict into 12-dimensional numerical vector for Scikit-Learn models."""
        return [
            float(features.get("total_reads", 0)),
            float(features.get("ant_1_reads", 0)),
            float(features.get("ant_2_reads", 0)),
            float(features.get("ant_3_reads", 0)),
            float(features.get("ant_4_reads", 0)),
            float(features.get("ant_1_rssi_med", -99.0)),
            float(features.get("ant_2_rssi_med", -99.0)),
            float(features.get("ant_3_rssi_med", -99.0)),
            float(features.get("ant_4_rssi_med", -99.0)),
            float(features.get("rssi_variance", 0.0)),
            float(features.get("last_seen_seconds", 9999.0)),
            float(features.get("reader_health", 1.0)),
            float(features.get("movement_flag", 0.0)),
            float(features.get("packaging_risk", 0.0)),
        ]

