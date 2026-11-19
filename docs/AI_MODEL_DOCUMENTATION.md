# AI Intelligence Models & Evaluation Documentation

## 1. Intelligence Architecture

The AI Intelligence Engine is designed as a modular, explainable decision-support suite. It operates under a strict human-in-the-loop philosophy: **AI models generate hypotheses and priority recommendations; official enterprise inventory records are only modified through verified operator scans or authorized transactions.**

```
                           RAW OBSERVATION WINDOW
                                     |
                                     v
                        FEATURE ENGINEERING PIPELINE
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
      [P0 READ-RELIABILITY]                       [P0 ROOT-CAUSE]
      - Calibrated Gradient Boosted               - 5-Class Hypothesis Ranker
      - Sigmoid Calibration                       - Preserves Uncertainty
      - Rules Baseline Comparator                 - Targeted Verification Action
               |                                           |
               +---------------------+---------------------+
                                     |
                                     v
                          [P1 EXTENSION MODELS]
               ├── Demand Forecasting (1d, 3d, 7d Horizon + Baselines)
               ├── Risk-Based Cycle Counting (Ranked Audit Prioritization)
               └── Misplacement Destination Inference (Top-3 Spatial Priors)
```

---

## 2. P0 Model 1: RFID Read-Reliability Prediction

### 2.1 Purpose
When an expected EPC is not observed in the recent observation window, determine whether the item is physically missing (`LIKELY_ABSENT`), physically present but RF-shadowed (`LIKELY_UNREAD`), or uncertain (`UNCERTAIN`).

### 2.2 Model Architecture
- **Classifier**: Supervised Gradient-Boosted Decision Trees (`HistGradientBoostingClassifier`).
- **Calibration**: `CalibratedClassifierCV` with Sigmoid calibration to ensure well-calibrated posterior probabilities.
- **Rules Baseline**: Deterministic 3-rule benchmark evaluated alongside the ML model:
  1. If reader offline -> `UNCERTAIN`
  2. If recent reads > 0 -> `LIKELY_PRESENT`
  3. If elapsed time > threshold -> `LIKELY_ABSENT`

### 2.3 Input Features
- Total read count across all antennas in sliding window
- Last-seen elapsed seconds ($t_{\text{now}} - t_{\text{last}}$)
- First-seen elapsed seconds
- Reader & antenna health status (1.0 = Online, 0.0 = Degraded)
- Tag packaging class (Cardboard, Plastic, Liquid proximity, Metal shielded)
- Historical read stability coefficient

### 2.4 Model Card & Validation Metrics
- **Model Version**: `read-reliability-calibrated-v1.2`
- **Validation Dataset**: 1,250 held-out physical observation windows across multiple sessions.
- **Accuracy**: $94.2\%$
- **Precision**: $93.1\%$
- **Recall**: $95.4\%$
- **Macro F1**: $94.2\%$
- **Brier Calibration Score**: $0.052$ (indicating tight calibration)

---

## 3. P0 Model 2: Discrepancy Root-Cause Explanation

### 3.1 Candidate Causes
The model classifies candidate causes across 5 distinct operational hypotheses:
1. **`PHYSICAL_RELOCATION`**: Stock physically moved to another bay without an authorized WMS pick/transfer.
2. **`RF_SHADOWING`**: Tag occluded behind dense liquid containers or reflective metal shielding.
3. **`INCORRECT_WMS_TRANSACTION`**: System paperwork indicates an item was picked or received that does not match physical reality.
4. **`DUPLICATE_EPC_MAPPING`**: Hardware commissioning anomaly where identical EPC was encoded to two distinct cartons.
5. **`READER_OUTAGE`**: Hardware disconnected, cable severed, or power failure on antenna port.

### 3.2 Explainability & Evidence Reasoning
For each hypothesis, the model returns:
- Calibrated probability across all 5 classes (preserving uncertainty)
- Top human-readable evidence strings (e.g. *"Strongest antenna reads localized to Shelf C while expected Shelf is A"*)
- Recommended verification action (e.g. *"Perform manual handheld RFID audit of Shelf C, Bay 2"*)

---

## 4. P1 Extension Models

### 4.1 AI Model 3: Stockout & Demand Forecasting
- **Horizons**: 1-day, 3-day, and 7-day item-level forecast.
- **Stockout Probability**: Models cumulative probability of inventory breaching `min_stock` reorder threshold.
- **Baselines**: Evaluated against 7-day Moving Average and Seasonal-Naive models.
- **Dataset Labeling**: All synthetic demonstration datasets are explicitly stamped with `"data_source": "SYNTHETIC_DEMO_DATA"`.
- **Validation Metrics**: Mean Absolute Error (MAE) $= 0.42$, WAPE $= 8.6\%$.

### 4.2 AI Model 4: Risk-Based Cycle Counting
- **Risk Score Formula**:
  $$\text{Risk Score} = P(\text{Discrepancy}) \times \text{Item Value} \times \text{Velocity Factor} \times \text{Staleness Factor}$$
- **Avoided Search Effort**: Projects avoided warehouse search minutes by ordering counts by highest discrepancy density.
- **Dashboard Directive**: *"Count these 5 bins first"*.

### 4.3 AI Model 5: Misplacement Destination Inference
- **Approach**: Combines antenna cross-read RSSI gradient, warehouse spatial proximity graph, and nearby EPC co-occurrence.
- **Output**: Ranked Top-3 candidate shelves with calibrated probabilities.
- **Safety Policy**: Explicitly warns operators that predictions are shelf-zone estimates and avoids claiming unvalidated centimeter-level bin precision.

