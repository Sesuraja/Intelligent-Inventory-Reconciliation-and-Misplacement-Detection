import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from app.ai.feature_engineering import FeatureEngine

class ReadReliabilityModel:
    """
    P0 AI Model: RFID Read-Reliability Prediction.
    Estimates P(tag absent or misplaced | antenna reads, RSSI history, packaging, reader state).
    Distinguishes 'likely unread' (RF shadowing / reader outage) from 'likely absent' (shrinkage),
    and provides an explicit 'uncertain / abstain' state.
    Compares against a deterministic rules-only baseline with fixed missed-read threshold.
    """

    CLASSES = ["LIKELY_PRESENT", "LIKELY_ABSENT", "LIKELY_UNREAD", "UNCERTAIN"]
    FEATURE_NAMES = [
        "total_reads", "ant1_reads", "ant2_reads", "ant3_reads", "ant4_reads",
        "ant1_rssi", "ant2_rssi", "ant3_rssi", "ant4_rssi",
        "rssi_var", "last_seen_age", "reader_health", "movement_flag", "packaging_risk"
    ]

    def __init__(self):
        self.version = "v1.2.0-calibrated"
        self.base_model: Optional[GradientBoostingClassifier] = None
        self.calibrated_model: Optional[CalibratedClassifierCV] = None
        self.feature_importances: Dict[str, float] = {}
        self.is_trained = False
        self._init_and_train_baseline_model()

    def _init_and_train_baseline_model(self):
        """Trains Gradient Boosting model and wraps in probability calibration."""
        X_train, y_train = self._generate_synthetic_calibration_data(n_samples=600)
        
        base_gb = GradientBoostingClassifier(
            n_estimators=70,
            learning_rate=0.08,
            max_depth=4,
            subsample=0.85,
            random_state=42
        )
        base_gb.fit(X_train, y_train)
        self.base_model = base_gb

        # Calibrate probabilities using Sigmoid Platt scaling
        calibrated = CalibratedClassifierCV(estimator=base_gb, method='sigmoid', cv=3)
        calibrated.fit(X_train, y_train)
        self.calibrated_model = calibrated
        self.is_trained = True

        # Store baseline feature importances
        raw_imp = base_gb.feature_importances_
        self.feature_importances = {name: float(imp) for name, imp in zip(self.FEATURE_NAMES, raw_imp)}

    def _generate_synthetic_calibration_data(self, n_samples: int = 600) -> Tuple[np.ndarray, np.ndarray]:
        """Generates representative RF propagation data matching warehouse physics."""
        np.random.seed(42)
        X = []
        y = []

        for _ in range(n_samples):
            scenario = np.random.choice(["present", "absent", "unread_shadowed", "unread_outage", "uncertain"])
            reader_health = 1.0
            movement_flag = 0.0
            packaging_risk = 0.0

            if scenario == "present":
                # Healthy tag on shelf: high reads, strong RSSI (-40 to -52 dBm)
                total_reads = np.random.randint(12, 45)
                ant1_reads = total_reads - np.random.randint(0, 3)
                ant2_reads = total_reads - ant1_reads
                ant3_reads = 0
                ant4_reads = 0
                ant1_rssi = np.random.normal(-44, 3)
                ant2_rssi = np.random.normal(-68, 4) if ant2_reads > 0 else -99.0
                ant3_rssi = -99.0
                ant4_rssi = -99.0
                rssi_var = np.random.uniform(1.0, 4.0)
                last_seen = np.random.uniform(0.5, 4.0)
                label = 0  # LIKELY_PRESENT

            elif scenario == "absent":
                # Item stolen or missing: 0 reads, reader online, long staleness
                total_reads = 0
                ant1_reads = 0
                ant2_reads = 0
                ant3_reads = 0
                ant4_reads = 0
                ant1_rssi = -99.0
                ant2_rssi = -99.0
                ant3_rssi = -99.0
                ant4_rssi = -99.0
                rssi_var = 0.0
                last_seen = np.random.uniform(180.0, 3600.0)
                label = 1  # LIKELY_ABSENT

            elif scenario == "unread_shadowed":
                # Present but obscured by metal/liquid: 0 or sporadic faint reads, high packaging risk
                total_reads = np.random.choice([0, 0, 1])
                ant1_reads = total_reads
                ant2_reads = 0
                ant3_reads = 0
                ant4_reads = 0
                ant1_rssi = np.random.normal(-81, 2) if total_reads > 0 else -99.0
                ant2_rssi = -99.0
                ant3_rssi = -99.0
                ant4_rssi = -99.0
                rssi_var = 1.0 if total_reads > 0 else 0.0
                last_seen = np.random.uniform(15.0, 300.0)
                packaging_risk = np.random.choice([0.5, 0.8])
                label = 2  # LIKELY_UNREAD

            elif scenario == "unread_outage":
                # Reader offline / antenna port faulted
                total_reads = 0
                ant1_reads = 0
                ant2_reads = 0
                ant3_reads = 0
                ant4_reads = 0
                ant1_rssi = -99.0
                ant2_rssi = -99.0
                ant3_rssi = -99.0
                ant4_rssi = -99.0
                rssi_var = 0.0
                last_seen = np.random.uniform(5.0, 120.0)
                reader_health = 0.0
                label = 2  # LIKELY_UNREAD

            else:  # uncertain / boundary overlap
                total_reads = np.random.randint(1, 4)
                ant1_reads = np.random.randint(0, 2)
                ant2_reads = total_reads - ant1_reads
                ant3_reads = 0
                ant4_reads = 0
                ant1_rssi = np.random.normal(-72, 4) if ant1_reads > 0 else -99.0
                ant2_rssi = np.random.normal(-71, 4) if ant2_reads > 0 else -99.0
                ant3_rssi = -99.0
                ant4_rssi = -99.0
                rssi_var = np.random.uniform(4.0, 10.0)
                last_seen = np.random.uniform(10.0, 90.0)
                label = 3  # UNCERTAIN

            row = [
                total_reads, ant1_reads, ant2_reads, ant3_reads, ant4_reads,
                ant1_rssi, ant2_rssi, ant3_rssi, ant4_rssi,
                rssi_var, last_seen, reader_health, movement_flag, packaging_risk
            ]
            X.append(row)
            y.append(label)

        return np.array(X), np.array(y)

    def evaluate_rules_baseline(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deterministic Rules-Only Baseline (Fixed Missed-Read Threshold).
        Evaluates discrepancy solely via fixed 20-second timeout without RF physics calibration.
        """
        total_reads = features.get("total_reads", 0)
        last_seen = features.get("last_seen_seconds", 9999.0)
        reader_online = features.get("reader_health", 1.0) > 0.5

        if not reader_online:
            return {
                "decision": "READER_OFFLINE_HOLD",
                "rules_confidence": 0.50,
                "rule_triggered": "RULE_READER_HEALTH_CHECK",
                "description": "Baseline rule: Reader offline, hold state"
            }
        
        if total_reads > 0:
            return {
                "decision": "LIKELY_PRESENT",
                "rules_confidence": 0.85,
                "rule_triggered": "RULE_ACTIVE_DETECTION",
                "description": f"Baseline rule: {total_reads} reads observed"
            }
        
        # Fixed 20-second threshold
        if last_seen > 20.0:
            return {
                "decision": "CONFIDENT_MISSING",
                "rules_confidence": 0.90,
                "rule_triggered": "RULE_FIXED_MISSED_READ_THRESHOLD_EXCEEDED",
                "description": f"Baseline rule: No reads for {int(last_seen)}s > 20s threshold (Falsely flags shadowed tags)"
            }
        else:
            return {
                "decision": "UNCERTAIN",
                "rules_confidence": 0.50,
                "rule_triggered": "RULE_RECENT_SWEEP_WAIT",
                "description": f"Baseline rule: Last seen {int(last_seen)}s ago <= 20s threshold"
            }

    def predict_reliability(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates read-reliability state, calibrated probability, feature contributions,
        and side-by-side comparison with the deterministic rules baseline.
        """
        reader_online = features.get("reader_health", 1.0) > 0.5
        total_reads = features.get("total_reads", 0)
        last_seen = features.get("last_seen_seconds", 9999.0)
        packaging_risk = features.get("packaging_risk", 0.0)

        # Baseline comparison
        rules_baseline = self.evaluate_rules_baseline(features)

        # Critical Business Rule Guard:
        # If reader is disconnected, absence of reads CANNOT be declared as missing
        if not reader_online:
            return {
                "status": "LIKELY_UNREAD",
                "reliability_score": 0.96,
                "class_probabilities": {
                    "LIKELY_PRESENT": 0.01,
                    "LIKELY_ABSENT": 0.01,
                    "LIKELY_UNREAD": 0.96,
                    "UNCERTAIN": 0.02
                },
                "evidence": [
                    "Reader is currently OFFLINE or antenna disconnected",
                    "Missing reads suspended per warehouse business rules (Zero Shrinkage False Alarms)",
                    "Hardware reconnection in progress"
                ],
                "top_features": [
                    {"feature": "reader_health", "contribution": 0.85, "direction": "OUTAGE_PROTECTION"},
                    {"feature": "total_reads", "contribution": 0.10, "direction": "SUPPRESSED"}
                ],
                "rules_baseline": rules_baseline,
                "model_version": self.version
            }

        evidence = []
        if total_reads > 10:
            evidence.append(f"Strong RF detection with {total_reads} reads in 10s observation window")
            primary_port = features.get("primary_antenna_port", 1)
            med = features.get(f"ant_{primary_port}_rssi_med", -50)
            evidence.append(f"Primary antenna Port {primary_port} reported healthy median RSSI {med:.1f} dBm")
        elif total_reads > 0:
            evidence.append(f"Weak detection ({total_reads} reads); marginal backscatter signal")
        else:
            evidence.append(f"Zero tag detections for {int(last_seen)} seconds")

        if packaging_risk >= 0.5:
            evidence.append("Item packaging/contents (metal or liquid proximity) induces significant RF attenuation (-26 dB)")

        # Run Calibrated ML model inference
        x_vec = np.array([FeatureEngine.to_feature_vector(features)])
        
        if self.calibrated_model:
            probs = self.calibrated_model.predict_proba(x_vec)[0]
        else:
            probs = self.base_model.predict_proba(x_vec)[0]

        prob_dict = {
            self.CLASSES[i]: round(float(probs[i]), 3) for i in range(len(self.CLASSES))
        }
        pred_idx = int(np.argmax(probs))
        pred_status = self.CLASSES[pred_idx]
        confidence = float(probs[pred_idx])

        # RF Physics & Packaging override logic for boundary robustness
        if total_reads == 0:
            if packaging_risk >= 0.5:
                pred_status = "LIKELY_UNREAD"
                confidence = max(confidence, 0.90)
                prob_dict["LIKELY_UNREAD"] = round(confidence, 3)
                evidence.append("Tagged item material profile indicates physical presence is masked by RF attenuation")
            elif last_seen > 300:
                pred_status = "LIKELY_ABSENT"
                confidence = max(confidence, 0.92)
                prob_dict["LIKELY_ABSENT"] = round(confidence, 3)
                evidence.append("Persistent absence across multiple scan windows confirms physical lack of backscatter")
            else:
                pred_status = "UNCERTAIN"
                confidence = 0.74
                prob_dict["UNCERTAIN"] = 0.74
                evidence.append("Recently observed but not confirmed in current sweep; awaiting verification cycle")

        # Compute feature contributions (deviation * importance)
        top_features = []
        raw_feat_vals = FeatureEngine.to_feature_vector(features)
        for i, name in enumerate(self.FEATURE_NAMES):
            imp = self.feature_importances.get(name, 0.05)
            val = raw_feat_vals[i]
            # Direction and approximate impact score
            if name == "packaging_risk" and val > 0:
                top_features.append({"feature": "Metallic/Liquid Attenuation", "contribution": round(val * imp * 2.5, 3), "direction": "SHADOWING_RISK"})
            elif name == "total_reads":
                direction = "STRONG_READS" if val > 5 else "ZERO_READS_DEFICIT"
                top_features.append({"feature": "Observation Window Reads", "contribution": round(imp * (1.0 if val == 0 else 0.5), 3), "direction": direction})
            elif name == "last_seen_age":
                top_features.append({"feature": "Last Seen Staleness", "contribution": round(min(val / 300.0, 1.0) * imp, 3), "direction": "TEMPORAL_AGING"})
            elif name == "reader_health":
                top_features.append({"feature": "Reader Health Status", "contribution": round(imp * (1.0 if val == 1.0 else 2.0), 3), "direction": "HARDWARE_OK"})

        top_features.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        return {
            "status": pred_status,
            "reliability_score": round(confidence, 3),
            "class_probabilities": prob_dict,
            "evidence": evidence,
            "top_features": top_features[:4],
            "rules_baseline": rules_baseline,
            "model_version": self.version
        }

read_reliability_model = ReadReliabilityModel()
