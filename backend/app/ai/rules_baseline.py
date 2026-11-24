"""
Deterministic Rules-Only Baseline & AI Comparison Module.
Implements W4 and W6b requirements:
- Expected by WMS in bin X, not seen for T seconds across N sweeps -> missing_baseline
- Seen on an antenna not covering bin X -> misplaced_baseline
- Seen on antenna covering bin X -> present_ok
- Below time/sweep threshold or weak coverage -> uncertain_verify
- Thresholds configurable per zone
- Standardized schema identical to AI output
- Rigorous AI vs Baseline comparison on identical EPCs with Wilson score 95% confidence intervals
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import math


def wilson_score_interval(successes: int, total: int, z: float = 1.96) -> Dict[str, float]:
    """
    Calculates Wilson score 95% confidence interval for a binomial proportion.
    Accurate for both small and large sample sizes.
    """
    if total <= 0:
        return {"proportion": 0.0, "ci_lower": 0.0, "ci_upper": 0.0, "sample_size": 0}

    p = successes / total
    denominator = 1.0 + (z ** 2) / total
    centre = (p + (z ** 2) / (2.0 * total)) / denominator
    margin = (z / denominator) * math.sqrt((p * (1.0 - p) / total) + (z ** 2) / (4.0 * (total ** 2)))

    ci_lower = max(0.0, centre - margin)
    ci_upper = min(1.0, centre + margin)

    return {
        "proportion": round(p, 4),
        "ci_lower": round(ci_lower, 4),
        "ci_upper": round(ci_upper, 4),
        "sample_size": total
    }


class DeterministicRulesBaseline:
    """
    Deterministic rules-only inventory reconciliation baseline.
    Operates without machine learning or RF physics calibration.
    Serves as the empirical benchmark to evaluate whether AI adds true lift.
    """

    DEFAULT_ZONE_CONFIG: Dict[str, Dict[str, Any]] = {
        "DEFAULT": {
            "timeout_seconds": 30.0,
            "min_sweeps_for_missing": 3,
            "min_rssi_threshold": -75.0,
            "min_reads_for_placement": 3
        },
        "ZONE_A": {
            "timeout_seconds": 30.0,
            "min_sweeps_for_missing": 3,
            "min_rssi_threshold": -75.0,
            "min_reads_for_placement": 3
        },
        "ZONE_B": {
            "timeout_seconds": 45.0,
            "min_sweeps_for_missing": 4,
            "min_rssi_threshold": -78.0,
            "min_reads_for_placement": 2
        }
    }

    def __init__(self, zone_overrides: Optional[Dict[str, Dict[str, Any]]] = None):
        self.version = "rules-baseline-v1.0"
        self.zone_configs = dict(self.DEFAULT_ZONE_CONFIG)
        if zone_overrides:
            self.zone_configs.update(zone_overrides)

    def get_zone_thresholds(self, zone_key: str = "DEFAULT") -> Dict[str, Any]:
        """Returns active thresholds for a given warehouse zone."""
        return self.zone_configs.get(zone_key, self.zone_configs["DEFAULT"])

    def set_zone_thresholds(self, zone_key: str, timeout_seconds: float, min_sweeps: int, min_rssi: float = -75.0) -> None:
        """Configures per-zone thresholds for missing and misplaced baseline rules."""
        self.zone_configs[zone_key] = {
            "timeout_seconds": float(timeout_seconds),
            "min_sweeps_for_missing": int(min_sweeps),
            "min_rssi_threshold": float(min_rssi),
            "min_reads_for_placement": 3
        }

    def evaluate_item(
        self,
        epc: str,
        expected_shelf: str,
        antenna_stats: Dict[int, Dict[str, Any]],
        last_seen_seconds: float,
        sweep_count: int,
        port_shelf_map: Dict[int, str],
        zone_key: str = "DEFAULT",
        is_simulated: bool = False,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates an individual item using deterministic baseline rules.
        Schema matches Section 2.2 scored event JSON specification.
        """
        cfg = self.get_zone_thresholds(zone_key)
        timeout_sec = cfg.get("timeout_seconds", 30.0)
        min_sweeps = cfg.get("min_sweeps_for_missing", 3)
        min_reads = cfg.get("min_reads_for_placement", 3)

        now_iso = datetime.now(timezone.utc).isoformat()
        reason_codes: List[str] = []

        # Find antennas that detected this EPC
        observed_shelves: List[Tuple[str, int, float]] = []
        for port, stats in antenna_stats.items():
            cnt = stats.get("read_count", 0)
            med_rssi = stats.get("median_rssi", -99.0)
            shelf = port_shelf_map.get(port)
            if shelf and cnt >= min_reads:
                observed_shelves.append((shelf, cnt, med_rssi))

        # Sort observed shelves by read count descending
        observed_shelves.sort(key=lambda x: x[1], reverse=True)

        if observed_shelves:
            top_observed_shelf, top_count, top_rssi = observed_shelves[0]
            if top_observed_shelf == expected_shelf:
                baseline_state = "present_ok"
                predicted_state = "present_ok"
                score = 1.0
                reason_codes.append("RULE_OBSERVED_ON_EXPECTED_ANTENNA")
            else:
                baseline_state = "misplaced_baseline"
                predicted_state = "likely_absent_or_misplaced"
                score = 1.0
                reason_codes.append(f"RULE_SEEN_ON_DIFFERENT_ANTENNA_{top_observed_shelf}")
            candidate_zones = [{"zone": top_observed_shelf, "confidence": 1.0}]
            root_cause_label = "physical_relocation" if baseline_state == "misplaced_baseline" else "none"
        else:
            candidate_zones = []
            if last_seen_seconds >= timeout_sec and sweep_count >= min_sweeps:
                baseline_state = "missing_baseline"
                predicted_state = "likely_absent_or_misplaced"
                score = 1.0
                reason_codes.append(f"RULE_UNSEEN_TIMEOUT_{int(last_seen_seconds)}S_SWEEPS_{sweep_count}")
                root_cause_label = "physical_relocation"
            else:
                # Abstain because threshold conditions not yet met
                baseline_state = "uncertain_verify"
                predicted_state = "uncertain_verify"
                score = 0.50
                reason_codes.append(f"RULE_INSUFFICIENT_SWEEPS_OR_TIME_{int(last_seen_seconds)}S_{sweep_count}_SWEEPS")
                root_cause_label = "unknown"

        return {
            "epc": epc,
            "predicted_state": predicted_state,
            "score": round(score, 3),
            "root_cause": {
                "label": root_cause_label,
                "probs": {root_cause_label: score}
            },
            "candidate_zones": candidate_zones,
            "count_priority": 0.0,
            "demand_forecast": {"d1": 0, "d3": 0, "d7": 0, "p_reorder": 0.0},
            "model_version": self.version,
            "baseline_state": baseline_state,
            "session_id": session_id or "session-default",
            "generated_at": now_iso,
            "reason_codes": reason_codes,
            "is_simulated": is_simulated,
            "validation_status": "experimental"
        }

    def compare_ai_vs_baseline(
        self,
        comparisons: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Produces rigorous statistical comparison between AI inference and deterministic baseline
        on identical EPCs.
        Computes sample sizes (n) and 95% Wilson confidence intervals.
        """
        n = len(comparisons)
        if n == 0:
            return {
                "sample_size_n": 0,
                "agreement_rate": {"proportion": 0.0, "ci_lower": 0.0, "ci_upper": 0.0},
                "ai_abstain_rate": {"proportion": 0.0, "ci_lower": 0.0, "ci_upper": 0.0},
                "baseline_missing_alerts": 0,
                "ai_shadowing_prevented_alerts": 0,
                "summary": "No items evaluated."
            }

        agreements = 0
        ai_abstains = 0
        baseline_missing = 0
        ai_prevented_false_missing = 0
        detailed_pairs = []

        for item in comparisons:
            epc = item.get("epc", "")
            ai_state = item.get("ai_predicted_state", "")
            base_state = item.get("baseline_state", "")

            # Check general state agreement
            # Map states to equivalent categories for comparison
            ai_cat = "present" if ai_state in ("present_ok", "IN_PLACE") else (
                "abstain" if ai_state in ("uncertain_verify", "AMBIGUOUS") else (
                    "unread" if ai_state in ("likely_unread", "POSSIBLE_UNREAD") else "discrepant"
                )
            )
            base_cat = "present" if base_state in ("present_ok", "present_baseline") else (
                "abstain" if base_state == "uncertain_verify" else "discrepant"
            )

            is_agree = (ai_cat == base_cat)
            if is_agree:
                agreements += 1

            if ai_state in ("uncertain_verify", "AMBIGUOUS", "UNCERTAIN"):
                ai_abstains += 1

            if base_state == "missing_baseline":
                baseline_missing += 1
                # If AI recognized this as RF unread/shadowed or abstained rather than declaring missing
                if ai_state in ("likely_unread", "POSSIBLE_UNREAD", "uncertain_verify"):
                    ai_prevented_false_missing += 1

            detailed_pairs.append({
                "epc": epc,
                "ai_state": ai_state,
                "baseline_state": base_state,
                "agree": is_agree,
                "ai_score": item.get("ai_score", 0.0),
                "is_simulated": item.get("is_simulated", True)
            })

        agreement_ci = wilson_score_interval(agreements, n)
        abstain_ci = wilson_score_interval(ai_abstains, n)

        return {
            "sample_size_n": n,
            "agreement_rate": agreement_ci,
            "ai_abstain_rate": abstain_ci,
            "baseline_missing_count": baseline_missing,
            "ai_shadowing_prevented_alerts": ai_prevented_false_missing,
            "comparisons": detailed_pairs,
            "validation_status": "experimental",
            "disclosure": (
                "Side-by-side comparison on identical EPCs. Metrics report measured results "
                "with Wilson score 95% confidence intervals and sample size n. AI makes no pre-set superiority claim."
            )
        }


rules_baseline_engine = DeterministicRulesBaseline()
