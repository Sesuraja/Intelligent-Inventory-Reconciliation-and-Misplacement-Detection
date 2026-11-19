from typing import Dict, Any, List, Optional
import numpy as np

class DestinationInferenceEngine:
    """
    P1 AI Model: Misplacement Destination Inference.
    When an item is absent from its expected shelf, infers the top-3 candidate
    destination shelves using the sequence of antenna detections, cross-read RSSI gradient,
    physical aisle proximity graph, and nearby EPC co-occurrence patterns.
    Calibrated probabilities are reported without claiming false centimeter-level accuracy.
    """

    # Warehouse layout adjacency & transit probabilities
    PROXIMITY_GRAPH = {
        "SHELF_A": [("SHELF_B", 0.60), ("SHELF_C", 0.25), ("SHELF_D", 0.15)],
        "SHELF_B": [("SHELF_A", 0.45), ("SHELF_C", 0.40), ("SHELF_D", 0.15)],
        "SHELF_C": [("SHELF_B", 0.50), ("SHELF_D", 0.30), ("SHELF_A", 0.20)],
        "SHELF_D": [("SHELF_C", 0.55), ("SHELF_B", 0.30), ("SHELF_A", 0.15)]
    }

    version = "destination-graph-v1.0"

    @classmethod
    def infer_destination(
        cls,
        epc: str,
        expected_shelf: str,
        recent_antenna_detections: Optional[Dict[str, float]] = None,
        neighbor_epc_shelves: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Combines spatial priors, antenna RSSI gradient, and co-occurring product locations
        to calculate a calibrated probability distribution over top-3 candidate shelves.
        """
        # Dynamically build spatial priors from warehouse shelf layout if needed
        neighbors = cls.PROXIMITY_GRAPH.get(expected_shelf)
        if not neighbors:
            try:
                import math
                from app.core.database import SessionLocal
                from app.models.location import Shelf
                db = SessionLocal()
                try:
                    all_shelves = db.query(Shelf).all()
                    current = next((s for s in all_shelves if s.shelf_code == expected_shelf), None)
                    c_x = current.coord_x if current and current.coord_x else 2.0
                    c_y = current.coord_y if current and current.coord_y else 2.0
                    other_shelves = [s for s in all_shelves if s.shelf_code != expected_shelf]
                    if other_shelves:
                        dists = []
                        for s in other_shelves:
                            s_x = s.coord_x if s.coord_x else (2.0 + s.id * 3.0)
                            s_y = s.coord_y if s.coord_y else 2.0
                            dist = math.sqrt((s_x - c_x)**2 + (s_y - c_y)**2)
                            dists.append((s.shelf_code, 1.0 / (1.0 + max(0.5, dist))))
                        total_inv_d = sum(p for _, p in dists)
                        neighbors = [(sc, round(p / total_inv_d, 2)) for sc, p in dists]
                finally:
                    db.close()
            except Exception:
                pass
        if not neighbors:
            neighbors = [("SHELF_B", 0.5), ("SHELF_C", 0.3), ("SHELF_D", 0.2)]

        candidate_scores = {}
        for shelf_code, prior in neighbors:
            candidate_scores[shelf_code] = prior

        # Factor 1: Recent antenna detections and RSSI gradient
        if recent_antenna_detections:
            for shelf_code, rssi in recent_antenna_detections.items():
                if shelf_code in candidate_scores:
                    # Normalized RSSI boost: -40 dBm is very strong (+0.45), -75 dBm is weak (+0.10)
                    norm_rssi = max(0.0, (rssi + 85.0) / 45.0)
                    candidate_scores[shelf_code] += norm_rssi * 0.45

        # Factor 2: Co-occurring items / neighboring EPC locations
        if neighbor_epc_shelves:
            for s in neighbor_epc_shelves:
                if s in candidate_scores:
                    candidate_scores[s] += 0.20

        # Convert to calibrated softmax-like probabilities
        scores = np.array(list(candidate_scores.values()))
        exp_s = np.exp(scores * 2.2)  # temperature scaling
        probs = exp_s / np.sum(exp_s)

        ranked = []
        for shelf_code, p in zip(candidate_scores.keys(), probs):
            ranked.append({
                "shelf_code": shelf_code,
                "confidence": round(float(p), 3),
                "rationale": f"Spatial proximity to {expected_shelf} + RF gradient weighting"
            })

        # Sort descending and take top 3
        ranked.sort(key=lambda x: x["confidence"], reverse=True)
        top3 = ranked[:3]
        top_dest = top3[0] if top3 else None

        return {
            "epc": epc,
            "expected_shelf": expected_shelf,
            "candidate_zones": top3,
            "top_predicted_shelf": top_dest["shelf_code"] if top_dest else None,
            "confidence": top_dest["confidence"] if top_dest else 0.0,
            "disclaimer": "Shelf-level zone estimate only. Centimeter-level precision requires manual handheld verification scan."
        }

destination_engine = DestinationInferenceEngine()
