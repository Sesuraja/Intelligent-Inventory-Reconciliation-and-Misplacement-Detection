from typing import Dict, Any, List

class CycleCountingEngine:
    """
    P1 AI Model: Risk-Based Cycle Counting Prioritizer.
    Ranks warehouse locations and SKUs for manual physical counts by:
    Operational Priority = Discrepancy Probability × Item Value × Operational Impact × Audit Staleness.
    Optimizes a time-budgeted verification list and calculates projected avoided search effort.
    """

    @classmethod
    def calculate_shelf_risk(
        cls,
        shelf_id: int,
        shelf_code: str,
        zone_name: str,
        open_exceptions_count: int,
        misplaced_count: int,
        total_shelf_value: float,
        items_count: int,
        days_since_last_audit: int = 14
    ) -> Dict[str, Any]:
        """
        Calculates normalized risk score (0-100) and projected avoided operator search effort.
        """
        # 1. Discrepancy Probability Factor (0 - 40 pts)
        discrepancy_score = min(40.0, (misplaced_count * 16.0) + (open_exceptions_count * 8.5))

        # 2. Dollar Valuation Risk Factor (0 - 25 pts)
        # Scales logarithmically/linearly up to $4,000
        valuation_score = min(25.0, (total_shelf_value / 4000.0) * 25.0)

        # 3. Expected Operational Impact / Velocity (0 - 20 pts)
        velocity_score = min(20.0, (items_count / 12.0) * 20.0)

        # 4. Audit Staleness Factor (0 - 15 pts)
        audit_staleness = min(15.0, (days_since_last_audit / 25.0) * 15.0)

        total_risk = round(discrepancy_score + valuation_score + velocity_score + audit_staleness, 1)

        if total_risk >= 65.0:
            priority = "HIGH"
        elif total_risk >= 35.0:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        # Projected avoided operator search effort:
        # Each misplaced or unread item at a high-velocity bay costs ~12-18 minutes in order-picking delays
        avoided_search_minutes = round((misplaced_count * 15.0) + (open_exceptions_count * 8.0) + (total_risk * 0.15), 1)

        return {
            "shelf_id": shelf_id,
            "shelf_code": shelf_code,
            "zone_name": zone_name,
            "risk_score": total_risk,
            "priority": priority,
            "projected_avoided_search_minutes": avoided_search_minutes,
            "factors": {
                "discrepancy_score": round(discrepancy_score, 1),
                "valuation_score": round(valuation_score, 1),
                "velocity_score": round(velocity_score, 1),
                "audit_staleness": round(audit_staleness, 1),
                "days_since_last_audit": days_since_last_audit,
                "total_shelf_value": round(total_shelf_value, 2)
            },
            "items_count": items_count
        }

    @classmethod
    def get_top_prioritized_audit_list(
        cls,
        shelves_data: List[Dict[str, Any]],
        time_budget_minutes: int = 60
    ) -> Dict[str, Any]:
        """
        Creates an optimized time-budgeted count list ('Count these shelves first')
        fitting within the operator's shift inspection window.
        """
        # Sort descending by risk score
        sorted_shelves = sorted(shelves_data, key=lambda x: x.get("risk_score", 0), reverse=True)
        
        selected = []
        spent_time = 0.0
        total_avoided_time = 0.0

        for s in sorted_shelves:
            # Approx 12 minutes to physically scan and recount one shelf
            count_time = 12.0
            if spent_time + count_time <= time_budget_minutes:
                selected.append(s)
                spent_time += count_time
                total_avoided_time += s.get("projected_avoided_search_minutes", 10.0)

        return {
            "time_budget_minutes": time_budget_minutes,
            "allocated_count_time_minutes": spent_time,
            "recommended_shelves_to_count_first": selected,
            "projected_avoided_search_effort_minutes": round(total_avoided_time, 1),
            "summary_recommendation": f"Prioritize counting {len(selected)} shelves first to prevent an estimated {round(total_avoided_time, 1)} minutes in search delays."
        }

cycle_counting_engine = CycleCountingEngine()
