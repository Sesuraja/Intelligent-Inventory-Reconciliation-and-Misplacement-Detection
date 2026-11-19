import numpy as np
from typing import Dict, Any, List, Optional
from scipy.special import softmax

class LocationInferenceEngine:
    """
    Antenna and Shelf Spatial Intelligence Engine.
    Estimates shelf-level locations from multi-antenna detection events.
    Never relies on strongest RSSI alone as definitive location evidence.
    Integrates:
    - Multi-antenna RSSI aggregation and count weighting
    - Dynamic calibration baselines and noise floors
    - Cross-reading leakage analysis and adjacent beam disambiguation
    - Reader/antenna failure compensation
    - Calibrated softmax shelf probability distribution
    """

    def __init__(self):
        self.version = "v1.3.0-calibrated"
        # Minimum RSSI separation to disambiguate adjacent shelves without manual check
        self.separation_threshold_db = 6.0
        self.min_confidence_auto_accept = 0.82

    def infer_location(
        self,
        epc: str,
        expected_shelf: str,
        antenna_stats: Dict[int, Dict[str, Any]],
        port_shelf_map: Dict[int, str],
        antenna_calibrations: Optional[Dict[int, Dict[str, float]]] = None,
        antenna_health: Optional[Dict[int, bool]] = None
    ) -> Dict[str, Any]:
        """
        Calculates location probabilities across candidate shelves.
        antenna_stats: {port: {"read_count": 25, "median_rssi": -42.0, "rssi_var": 2.1}}
        port_shelf_map: {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
        antenna_calibrations: {port: {"median_rssi_baseline": -45.0, "noise_floor_dbm": -85.0, "cross_read_leakage_dbm": -68.0}}
        antenna_health: {port: True/False}
        """
        if not antenna_stats:
            # Check if expected shelf antenna is offline before claiming missing
            expected_ports = [p for p, s in port_shelf_map.items() if s == expected_shelf]
            all_expected_down = bool(expected_ports and antenna_health and all(not antenna_health.get(p, True) for p in expected_ports))

            return {
                "epc": epc,
                "expected_location": expected_shelf,
                "predicted_location": None,
                "confidence": 0.0,
                "predicted_state": "POSSIBLE_UNREAD" if all_expected_down else "LIKELY_MISSING",
                "verification_required": True,
                "candidate_locations": [],
                "cross_reading_detected": False,
                "model_version": self.version,
                "note": "Antenna covering expected shelf is OFFLINE" if all_expected_down else "Zero detections recorded across all ports"
            }

        # Aggregate evidence by shelf (supports multiple antennas per shelf or 1-to-1)
        shelf_scores = {}
        shelf_meta = {}

        total_system_reads = sum(s.get("read_count", 0) for s in antenna_stats.values())
        max_reads = max((s.get("read_count", 0) for s in antenna_stats.values()), default=1)

        for port, stats in antenna_stats.items():
            shelf = port_shelf_map.get(port)
            if not shelf:
                continue

            # Check if antenna is healthy
            if antenna_health and not antenna_health.get(port, True):
                continue

            read_cnt = stats.get("read_count", 0)
            med_rssi = stats.get("median_rssi", -99.0)

            # Retrieve antenna calibration parameters if available
            calib = (antenna_calibrations or {}).get(port, {})
            noise_floor = calib.get("noise_floor_dbm", -85.0)
            baseline_rssi = calib.get("median_rssi_baseline", -45.0)
            leakage_threshold = calib.get("cross_read_leakage_dbm", -68.0)

            if read_cnt == 0 or med_rssi < (noise_floor + 2.0):
                continue

            # 1. Multi-factor energy scoring: combines relative signal power + read frequency
            # Normalized RSSI against antenna baseline and noise floor
            rssi_span = max(15.0, baseline_rssi - noise_floor)
            norm_rssi = max(0.0, min(1.0, (med_rssi - noise_floor) / rssi_span))

            # Read count proportion (ratio of total observations)
            count_factor = read_cnt / max(1.0, float(max_reads))
            preponderance_factor = read_cnt / max(1.0, float(total_system_reads))

            # Never use strongest RSSI alone:
            # Score weights: 50% normalized RF power, 30% relative count, 20% preponderance
            rf_score = (norm_rssi * 0.50) + (count_factor * 0.30) + (preponderance_factor * 0.20)

            # Damp potential side-lobe cross-reading leakage if below leakage threshold
            if med_rssi < leakage_threshold and count_factor < 0.35:
                rf_score *= 0.65  # Penalize cross-read artifact

            shelf_scores[shelf] = shelf_scores.get(shelf, 0.0) + rf_score
            shelf_meta[shelf] = {
                "antenna_port": port,
                "read_count": read_cnt,
                "median_rssi": round(med_rssi, 1),
                "norm_rssi": round(norm_rssi, 2),
                "preponderance": round(preponderance_factor, 2)
            }

        if not shelf_scores:
            return {
                "epc": epc,
                "expected_location": expected_shelf,
                "predicted_location": None,
                "confidence": 0.0,
                "predicted_state": "LIKELY_MISSING",
                "verification_required": True,
                "candidate_locations": [],
                "cross_reading_detected": False,
                "model_version": self.version
            }

        shelves = list(shelf_scores.keys())
        raw_scores = np.array([shelf_scores[s] for s in shelves])

        # Temperature-scaled Softmax for well-calibrated probabilities
        temperature = 0.32
        probs = softmax(raw_scores / temperature)

        candidates = []
        for i, s in enumerate(shelves):
            meta = shelf_meta.get(s, {})
            candidates.append({
                "shelf_code": s,
                "probability": round(float(probs[i]), 3),
                "antenna_code": f"ANT-0{meta.get('antenna_port', 1)}",
                "antenna_port": meta.get("antenna_port", 1),
                "median_rssi": meta.get("median_rssi"),
                "read_count": meta.get("read_count")
            })

        # Sort descending by probability
        candidates.sort(key=lambda x: x["probability"], reverse=True)

        top_candidate = candidates[0]
        top_shelf = top_candidate["shelf_code"]
        top_prob = top_candidate["probability"]

        # Cross-reading & Ambiguity Analysis
        is_ambiguous = False
        cross_reading = False

        if len(candidates) > 1:
            second = candidates[1]
            second_shelf = second["shelf_code"]
            second_prob = second["probability"]

            top_rssi = top_candidate.get("median_rssi", -99.0)
            second_rssi = second.get("median_rssi", -99.0)
            rssi_diff = abs(top_rssi - second_rssi)

            # If RSSI difference is smaller than separation threshold and read counts are substantial on both
            if rssi_diff < self.separation_threshold_db:
                cross_reading = True
                if (top_prob - second_prob) < 0.28 or top_prob < 0.65:
                    is_ambiguous = True

        # State Determination
        if is_ambiguous:
            state = "AMBIGUOUS"
            verification_required = True
            predicted_loc = None
        elif top_shelf == expected_shelf:
            state = "IN_PLACE"
            verification_required = False
            predicted_loc = top_shelf
        else:
            state = "MISPLACED"
            verification_required = True
            predicted_loc = top_shelf

        return {
            "epc": epc,
            "expected_location": expected_shelf,
            "predicted_location": predicted_loc,
            "confidence": round(top_prob, 3),
            "predicted_state": state,
            "verification_required": verification_required,
            "candidate_locations": candidates,
            "cross_reading_detected": cross_reading,
            "model_version": self.version
        }

location_engine = LocationInferenceEngine()
