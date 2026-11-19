from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import json

from app.models.inventory import Inventory, InventoryMovement
from app.models.location import Shelf
from app.models.rfid_tag import RFIDTag
from app.models.product import Product
from app.models.discrepancy import Discrepancy, LocationPrediction
from app.models.ai_model import AIPrediction
from app.models.reader import Reader, Antenna
from app.models.rfid_event import RFIDEvent
from app.ai.feature_engineering import FeatureEngine
from app.ai.location_inference import location_engine
from app.ai.read_reliability import read_reliability_model
from app.ai.root_cause import root_cause_model
from app.realtime.websocket_manager import ws_manager

class ReconciliationService:
    """
    Inventory Reconciliation and Discrepancy Engine.
    Coordinates physical RFID observations, expected WMS locations,
    and AI models to identify and explain discrepancies.
    """

    @classmethod
    async def reconcile_all(cls, db: Session, recent_events: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Runs comprehensive reconciliation cycle across all registered inventory.
        """
        now = datetime.now(timezone.utc)
        
        # 1. Fetch readers & antennas mapping
        from app.models.reader import AntennaCalibration
        antennas = db.query(Antenna).all()
        port_shelf_map = {}
        antenna_id_map = {}
        ant_health = {}
        for ant in antennas:
            port_shelf_map[ant.port_number] = ant.shelf.shelf_code if ant.shelf else None
            antenna_id_map[ant.port_number] = ant.id
            ant_health[ant.port_number] = ant.is_active

        calibs = db.query(AntennaCalibration).all()
        ant_calibs = {}
        for c in calibs:
            if c.antenna:
                ant_calibs[c.antenna.port_number] = {
                    "median_rssi_baseline": c.median_rssi_baseline,
                    "noise_floor_dbm": c.noise_floor_dbm,
                    "cross_read_leakage_dbm": c.cross_read_leakage_dbm
                }

        reader = db.query(Reader).filter(Reader.reader_code == "READER_01").first()
        reader_online = (reader.status == "ONLINE") if reader else True

        # Shelf code to Shelf ID map
        shelves = db.query(Shelf).all()
        shelf_code_to_id = {s.shelf_code: s.id for s in shelves}
        shelf_id_to_code = {s.id: s.shelf_code for s in shelves}

        # 2. Fetch all inventory records
        inventory_items = db.query(Inventory).all()
        
        reconciliation_results = []
        new_exceptions_count = 0

        # Organize events by EPC and port
        epc_events: Dict[str, List[Dict[str, Any]]] = {}
        if recent_events:
            for evt in recent_events:
                e = evt.get("epc")
                if e not in epc_events:
                    epc_events[e] = []
                epc_events[e].append(evt)

        for item in inventory_items:
            epc = item.epc
            expected_shelf = item.expected_shelf.shelf_code if item.expected_shelf else "SHELF_A"
            pkg_class = item.tag.packaging_class if item.tag else "CARDBOARD"
            
            # Check recent movement authorization
            recent_mov = db.query(InventoryMovement).filter(
                InventoryMovement.epc == epc
            ).order_by(InventoryMovement.timestamp.desc()).first()

            unauthorized_move = False
            if recent_mov and recent_mov.authorized == 0:
                unauthorized_move = True

            evts = epc_events.get(epc, [])
            
            # Multi-antenna stats aggregation
            ant_stats: Dict[int, Dict[str, Any]] = {}
            for port in [1, 2, 3, 4]:
                port_evts = [e for e in evts if (e.get("antenna_port") == port or e.get("antenna_id") == port)]
                if port_evts:
                    rssis = [e.get("rssi_dbm", -70.0) for e in port_evts]
                    import numpy as np
                    ant_stats[port] = {
                        "read_count": len(port_evts),
                        "median_rssi": float(np.median(rssis))
                    }

            # Run Location Inference
            loc_result = location_engine.infer_location(
                epc=epc,
                expected_shelf=expected_shelf,
                antenna_stats=ant_stats,
                port_shelf_map=port_shelf_map,
                antenna_calibrations=ant_calibs,
                antenna_health=ant_health
            )

            # Run Feature extraction for Read-Reliability
            feat = FeatureEngine.extract_epc_features(
                epc=epc,
                expected_shelf_code=expected_shelf,
                events=evts,
                reader_online=reader_online,
                recent_movement_authorized=not unauthorized_move if recent_mov else None,
                packaging_class=pkg_class
            )

            predicted_state = loc_result["predicted_state"]
            pred_shelf_code = loc_result["predicted_location"]
            confidence = loc_result["confidence"]

            # If no reads detected, consult Read-Reliability Model
            if not ant_stats:
                reliability_result = read_reliability_model.predict_reliability(feat)
                if reliability_result["status"] == "LIKELY_UNREAD":
                    predicted_state = "POSSIBLE_UNREAD"
                else:
                    predicted_state = "LIKELY_MISSING"
                confidence = reliability_result["reliability_score"]
                pred_shelf_code = None

            # Update Inventory status
            item.status = predicted_state
            item.confidence = confidence
            item.last_reconciled_at = now
            if pred_shelf_code and pred_shelf_code in shelf_code_to_id:
                item.observed_location_id = shelf_code_to_id[pred_shelf_code]
                item.last_observed_at = now
            elif not ant_stats:
                # keep previous or null
                pass

            # Manage Discrepancy lifecycle: 1 record per EPC, updated in place
            existing_disc = db.query(Discrepancy).filter(
                Discrepancy.epc == epc
            ).order_by(Discrepancy.id.desc()).first()

            if predicted_state in ["MISPLACED", "LIKELY_MISSING", "POSSIBLE_UNREAD", "AMBIGUOUS"]:
                # Needs active exception
                root_cause = root_cause_model.explain_discrepancy(
                    epc=epc,
                    discrepancy_type=predicted_state,
                    expected_shelf=expected_shelf,
                    observed_shelf=pred_shelf_code,
                    reader_online=reader_online,
                    unauthorized_move=unauthorized_move,
                    packaging_class=pkg_class,
                    candidate_shelves=loc_result.get("candidate_locations")
                )

                obs_shelf_id = shelf_code_to_id.get(pred_shelf_code) if pred_shelf_code else None

                if not existing_disc:
                    new_disc = Discrepancy(
                        epc=epc,
                        discrepancy_type=predicted_state,
                        expected_location_id=item.expected_location_id,
                        observed_location_id=obs_shelf_id,
                        confidence=confidence,
                        root_cause=root_cause["predicted_cause"],
                        status="AI_ANALYZED",
                        verification_required=True,
                        created_at=now
                    )
                    db.add(new_disc)
                    db.flush()

                    # Attach AI Prediction explanation
                    ai_pred = AIPrediction(
                        discrepancy_id=new_disc.id,
                        model_name="Root-Cause & Location Fusion",
                        model_version="v1.2.0",
                        prediction=root_cause["predicted_cause"],
                        score=confidence,
                        evidence=root_cause["evidence"],
                        recommended_action=root_cause["recommended_action"]
                    )
                    db.add(ai_pred)
                    new_exceptions_count += 1
                else:
                    # Update existing record in place
                    existing_disc.discrepancy_type = predicted_state
                    existing_disc.observed_location_id = obs_shelf_id
                    existing_disc.confidence = confidence
                    existing_disc.root_cause = root_cause["predicted_cause"]
                    existing_disc.status = "AI_ANALYZED"
                    
                    # Update or append AI prediction
                    if existing_disc.ai_predictions:
                        pred_rec = existing_disc.ai_predictions[0]
                        pred_rec.prediction = root_cause["predicted_cause"]
                        pred_rec.score = confidence
                        pred_rec.evidence = root_cause["evidence"]
                        pred_rec.recommended_action = root_cause["recommended_action"]
                    else:
                        db.add(AIPrediction(
                            discrepancy_id=existing_disc.id,
                            model_name="Root-Cause & Location Fusion",
                            model_version="v1.2.0",
                            prediction=root_cause["predicted_cause"],
                            score=confidence,
                            evidence=root_cause["evidence"],
                            recommended_action=root_cause["recommended_action"]
                        ))

            elif predicted_state == "IN_PLACE":
                # If was open discrepancy and now legitimately IN_PLACE, mark resolved
                if existing_disc and existing_disc.status != "RESOLVED":
                    existing_disc.status = "RESOLVED"
                    existing_disc.resolved_at = now

            reconciliation_results.append({
                "epc": epc,
                "status": predicted_state,
                "expected": expected_shelf,
                "observed": pred_shelf_code,
                "confidence": confidence
            })

        db.commit()

        # Broadcast live updates to WebSockets
        await ws_manager.broadcast("inventory-updates", {
            "type": "RECONCILIATION_COMPLETED",
            "timestamp": now.isoformat(),
            "total_reconciled": len(reconciliation_results),
            "new_exceptions": new_exceptions_count
        })

        return {
            "reconciled_items": len(reconciliation_results),
            "new_exceptions": new_exceptions_count,
            "timestamp": now.isoformat()
        }

