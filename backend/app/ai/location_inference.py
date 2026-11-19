import numpy as np
from typing import Dict, Any, List, Optional
from scipy.special import softmax

class LocationInferenceEngine:
    """
    Antenna and Shelf Intelligence Engine.
    Estimates shelf-level locations from multi-antenna detection events.
    Handles cross-reading, ambiguity, and calibration baselines.
    """

    def __init__(self):
        self.version = "v1.1.0"
        # Minimum RSSI separation to disambiguate adjacent shelves without manual check
        self.separation_threshold_db = 6.0
        self.min_confidence_auto_accept = 0.82

    def infer_location(
        self,
        epc: str,
        expected_shelf: str,
        antenna_stats: Dict[int, Dict[str, Any]],
        port_shelf_map: Dict[int, str]
    ) -> Dict[str, Any]:
        """
        Calculates location probabilities across candidate shelves.
        antenna_stats: {port: {"read_count": 25, "median_rssi": -42.0}}
        port_shelf_map: {1: "SHELF_A", 2: "SHELF_B", 3: "SHELF_C", 4: "SHELF_D"}
        """
        if not antenna_stats:
            return {
                "epc": epc,
                "expected_location": expected_shelf,
                "predicted_location": None,
                "confidence": 0.0,
                "predicted_state": "LIKELY_MISSING",
                "verification_required": True,
                "candidate_locations": [],
                "model_version": self.version
            }

        # Aggregate evidence by shelf (in case multiple antennas cover a shelf or 1-to-1)
        shelf_scores = {}
        shelf_meta = {}

        for port, stats in antenna_stats.items():
            shelf = port_shelf_map.get(port)
            if not shelf:
                continue
            
            read_cnt = stats.get("read_count", 0)
            med_rssi = stats.get("median_rssi", -99.0)

            if read_cnt == 0 or med_rssi < -85.0:
                continue

            # Scoring combining RSSI log power and count weighting
            # RSSI normalized from [-85, -35] -> [0, 1]
            norm_rssi = max(0.0, min(1.0, (med_rssi - (-85.0)) / 50.0))
            count_factor = min(1.0, read_cnt / 15.0)

            # Combined unnormalized RF energy score
            score = (norm_rssi * 0.7) + (count_factor * 0.3)
            
            shelf_scores[shelf] = shelf_scores.get(shelf, 0.0) + score
            shelf_meta[shelf] = {
                "antenna_port": port,
                "read_count": read_cnt,
                "median_rssi": med_rssi
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
                "model_version": self.version
            }

        shelves = list(shelf_scores.keys())
        raw_scores = np.array([shelf_scores[s] for s in shelves])

        # Temperature-scaled Softmax for well-calibrated probabilities
        temperature = 0.28
        probs = softmax(raw_scores / temperature)

        candidates = []
        for i, s in enumerate(shelves):
            meta = shelf_meta.get(s, {})
            candidates.append({
                "shelf_code": s,
                "probability": round(float(probs[i]), 3),
                "antenna_code": f"ANT-0{meta.get('antenna_port', 1)}",
                "median_rssi": meta.get("median_rssi"),
                "read_count": meta.get("read_count")
            })

        # Sort descending by probability
        candidates.sort(key=lambda x: x["probability"], reverse=True)

        top_candidate = candidates[0]
        top_shelf = top_candidate["shelf_code"]
        top_prob = top_candidate["probability"]

        # Check for ambiguity
        is_ambiguous = False
        if len(candidates) > 1:
            second_prob = candidates[1]["probability"]
            # If top two shelves are close in probability (e.g. difference < 0.25)
            if (top_prob - second_prob) < 0.25 or top_prob < 0.65:
                is_ambiguous = True

        # Determine predicted state
        if is_ambiguous:
            state = "AMBIGUOUS"
            verification_required = True
        elif top_shelf == expected_shelf:
            state = "IN_PLACE"
            verification_required = False
        else:
            state = "MISPLACED"
            verification_required = True

        return {
            "epc": epc,
            "expected_location": expected_shelf,
            "predicted_location": top_shelf if not is_ambiguous else None,
            "confidence": round(top_prob, 3),
            "predicted_state": state,
            "verification_required": verification_required,
            "candidate_locations": candidates,
            "model_version": self.version
        }

location_engine = LocationInferenceEngine()
