import os
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Role
from app.models.location import Warehouse, Zone, Shelf, Bin
from app.models.product import Product
from app.models.rfid_tag import RFIDTag
from app.models.reader import Reader, Antenna, AntennaCalibration
from app.models.inventory import Inventory, InventoryMovement
from app.models.discrepancy import Discrepancy, LocationPrediction, VerificationLog
from app.models.ai_model import AIPrediction, AIModel, ModelTrainingRun
from app.models.audit import AuditLog
from app.models.handheld import HandheldDevice, HandheldScanSession, HandheldScanEvent, GroundTruthVerification
from app.models.wms import WMSInventory, WMSOrder, WMSOrderLine, WMSTransaction
from app.models.rfid_event import RFIDEvent, ObservationWindow

# 38 Physical EPC tags actively streaming from Aperture Fixed UHF Gateway (serialno: 100EHH5323020053)
GATEWAY_PHYSICAL_EPCS = [
    "00000000",
    "000000000000000000000327",
    "000000000000000000000977",
    "000000000000000000001744",
    "000000000000000000110600",
    "000000000000000001000002",
    "00000000000000000A101093",
    "000000000000000013781616",
    "000000000000000013781617",
    "000000000000000140510038",
    "00000000000000A000009893",
    "00000000001B2A4601001704",
    "00035FFFFF80000001002329",
    "1000FFFFFFFFFFFFFFFFFFFF",
    "1A80B18C7809A71982647AC2",
    "1A88ECBBF37A3E06AA60610D",
    "1A94AB0F39A9A642EA406D67",
    "202202110051",
    "3005FB63AC1F3841EC880467",
    "300833B2DDD9014000000000",
    "3030E41E750000DFA0D1E52D",
    "3030E41E750000E1ED57605F",
    "3030E41E750000E55C41153F",
    "3030E41E750000FF100E1C06",
    "30341ADB10521280257A10A9",
    "3852",
    "410001010041410001010041",
    "E200001B540101292420646C",
    "E200001B54010173242098EA",
    "E20020839510013718705283",
    "E2003000041800580520E1AF",
    "E2004125180701231880524C",
    "E2006307070E027518307503",
    "E2009027621101880200F27C",
    "E28011606000020788842D21",
    "E28011704000021CDF305C66",
    "E28011704000021CDF306565",
    "FFFFFF000000000000000000",
]

def _migrate_schema():
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                # Ensure rfid_events.source column exists
                res = conn.execute(text("PRAGMA table_info(rfid_events)")).fetchall()
                col_names = [r[1] for r in res]
                if col_names and "source" not in col_names:
                    conn.execute(text("ALTER TABLE rfid_events ADD COLUMN source VARCHAR(20) DEFAULT 'PHYSICAL'"))

                # Ensure observation_windows.source column exists
                res2 = conn.execute(text("PRAGMA table_info(observation_windows)")).fetchall()
                col_names2 = [r[1] for r in res2]
                if col_names2 and "source" not in col_names2:
                    conn.execute(text("ALTER TABLE observation_windows ADD COLUMN source VARCHAR(20) DEFAULT 'PHYSICAL'"))

                # Ensure rfid_tags columns exist
                res_tags = conn.execute(text("PRAGMA table_info(rfid_tags)")).fetchall()
                col_tags = [r[1] for r in res_tags]
                if col_tags:
                    if "pallet_id" not in col_tags:
                        conn.execute(text("ALTER TABLE rfid_tags ADD COLUMN pallet_id VARCHAR(50)"))
                    if "carton_id" not in col_tags:
                        conn.execute(text("ALTER TABLE rfid_tags ADD COLUMN carton_id VARCHAR(50)"))
                    if "retired_at" not in col_tags:
                        conn.execute(text("ALTER TABLE rfid_tags ADD COLUMN retired_at DATETIME"))
                    if "retirement_reason" not in col_tags:
                        conn.execute(text("ALTER TABLE rfid_tags ADD COLUMN retirement_reason VARCHAR(255)"))

                # Ensure wms_transactions columns exist
                res_tx = conn.execute(text("PRAGMA table_info(wms_transactions)")).fetchall()
                col_tx = [r[1] for r in res_tx]
                if col_tx:
                    if "is_reversed" not in col_tx:
                        conn.execute(text("ALTER TABLE wms_transactions ADD COLUMN is_reversed BOOLEAN DEFAULT 0"))
                    if "reversal_of_transaction_id" not in col_tx:
                        conn.execute(text("ALTER TABLE wms_transactions ADD COLUMN reversal_of_transaction_id INTEGER"))
                    if "approval_status" not in col_tx:
                        conn.execute(text("ALTER TABLE wms_transactions ADD COLUMN approval_status VARCHAR(30) DEFAULT 'PENDING'"))
                    if "approved_by" not in col_tx:
                        conn.execute(text("ALTER TABLE wms_transactions ADD COLUMN approved_by VARCHAR(100)"))
                    if "approved_at" not in col_tx:
                        conn.execute(text("ALTER TABLE wms_transactions ADD COLUMN approved_at DATETIME"))
    except Exception as e:
        print(f"Schema migration notice: {e}")

def seed_database():
    """Initializes tables and populates live hardware seed data for the UHF RFID gateway."""
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    db: Session = SessionLocal()

    try:
        # Check if already seeded with the live hardware reader
        live_reader = db.query(Reader).filter(Reader.reader_code == settings.RFID_READER_ID).first()
        if live_reader and db.query(RFIDTag).filter(RFIDTag.epc == GATEWAY_PHYSICAL_EPCS[0]).first():
            print(f"Database already seeded with Aperture UHF Gateway reader ({settings.RFID_READER_ID}).")
            _seed_handheld_and_wms(db, datetime.now(timezone.utc))
            return

        print("Clearing legacy mock data and seeding live Aperture UHF RFID hardware data...")
        from sqlalchemy import text
        if settings.DATABASE_URL.startswith("sqlite"):
            db.execute(text("PRAGMA foreign_keys = OFF;"))
            db.commit()

        # Clear legacy items if present
        try:
            from app.models.cycle_count import CycleCountItem, CycleCountTask
            db.query(CycleCountItem).delete()
            db.query(CycleCountTask).delete()
        except Exception:
            pass

        db.query(VerificationLog).delete()
        db.query(LocationPrediction).delete()
        db.query(AIPrediction).delete()
        db.query(Discrepancy).delete()
        db.query(InventoryMovement).delete()
        db.query(Inventory).delete()
        db.query(WMSInventory).delete()
        db.query(RFIDTag).delete()
        db.query(AntennaCalibration).delete()
        db.query(Antenna).delete()
        db.query(Reader).delete()
        db.commit()

        if settings.DATABASE_URL.startswith("sqlite"):
            db.execute(text("PRAGMA foreign_keys = ON;"))
            db.commit()

        now = datetime.now(timezone.utc)

        # 1. Roles & Users
        if db.query(Role).count() == 0:
            roles = {
                "Admin": Role(role_name="Administrator", description="Full system access"),
                "Manager": Role(role_name="Warehouse Manager", description="Inventory, exceptions, reports"),
                "Operator": Role(role_name="Warehouse Operator", description="View, verify, resolve assigned exceptions"),
                "Engineer": Role(role_name="Technical Engineer", description="Readers, antennas, calibration, models")
            }
            for r in roles.values():
                db.add(r)
            db.flush()

            admin_pass = os.getenv("SEED_ADMIN_PASSWORD", "admin123")
            operator_pass = os.getenv("SEED_OPERATOR_PASSWORD", "operator123")

            admin_user = User(
                name="Sarah Jenkins",
                email="admin@warehouse.io",
                password_hash=get_password_hash(admin_pass),
                role_id=roles["Admin"].id,
                created_at=now
            )
            operator_user = User(
                name="Alex Rivera",
                email="operator@warehouse.io",
                password_hash=get_password_hash(operator_pass),
                role_id=roles["Operator"].id,
                created_at=now
            )
            db.add_all([admin_user, operator_user])
            db.flush()

        # 2. Warehouse, Zones, Shelves
        wh = db.query(Warehouse).first()
        if not wh:
            wh = Warehouse(
                name="Aperture Logistics & Testing Facility",
                code="WH-APERTURE-01",
                description="Live UHF RFID automated distribution and tracking facility"
            )
            db.add(wh)
            db.flush()

        zone_a = db.query(Zone).filter(Zone.code == "ZONE-A").first()
        if not zone_a:
            zone_a = Zone(warehouse_id=wh.id, name="Zone A (Bay A - Fast Pick)", code="ZONE-A")
            db.add(zone_a)
            db.flush()

        zone_b = db.query(Zone).filter(Zone.code == "ZONE-B").first()
        if not zone_b:
            zone_b = Zone(warehouse_id=wh.id, name="Zone B (Bay B - Specialty Storage)", code="ZONE-B")
            db.add(zone_b)
            db.flush()

        shelves_data = [
            ("SHELF_A", "Shelf A - Bay A Port 1", zone_a.id, 2.0, 1.0),
            ("SHELF_B", "Shelf B - Bay B Port 2", zone_a.id, 5.0, 1.0),
            ("SHELF_C", "Shelf C - Overflow", zone_a.id, 8.0, 1.0),
            ("SHELF_D", "Shelf D - Specialty", zone_b.id, 12.0, 1.0),
        ]
        shelf_objs: Dict[str, Shelf] = {}
        for code, name, zid, cx, cy in shelves_data:
            s = db.query(Shelf).filter(Shelf.shelf_code == code).first()
            if not s:
                s = Shelf(zone_id=zid, shelf_code=code, name=name, capacity=50, coord_x=cx, coord_y=cy)
                db.add(s)
                db.flush()
            shelf_objs[code] = s

        # 3. Fixed Aperture UHF Gateway Reader & 2 Physical Antennas
        reader = Reader(
            reader_code=settings.RFID_READER_ID,
            name="Aperture UHF Fixed Gateway",
            model="Aperture UHF Fixed Gateway (2-Port HTTP)",
            ip_address="gateway.apertureventurestudio.com",
            port=443,
            protocol="HTTP_GATEWAY",
            status="ONLINE",
            last_heartbeat=now,
            location_desc="Aperture Studio Testing Bay - Shelf A / B Overhead Mount"
        )
        db.add(reader)
        db.flush()

        antennas_data = [
            ("ANT-01", 1, shelf_objs["SHELF_A"].id, "Primary detection Shelf A (Bay A)"),
            ("ANT-02", 2, shelf_objs["SHELF_B"].id, "Primary detection Shelf B (Bay B)"),
        ]
        for acode, port, sid, purpose in antennas_data:
            ant = Antenna(
                reader_id=reader.id,
                antenna_code=acode,
                port_number=port,
                shelf_id=sid,
                tx_power_dbm=30.0,
                gain_dbi=6.0,
                beam_angle_deg=70.0,
                is_active=True,
                purpose=purpose
            )
            db.add(ant)
            db.flush()

            cal = AntennaCalibration(
                antenna_id=ant.id,
                median_rssi_baseline=-45.0,
                noise_floor_dbm=-85.0,
                cross_read_leakage_dbm=-68.0,
                calibration_date=now - timedelta(days=1)
            )
            db.add(cal)

        # 4. Products Master
        products_info = [
            ("SKU-1001", "Industrial Barcode Scanner", "Electronics", "piece", 320.0, 5, "CARDBOARD"),
            ("SKU-1002", "Lithium Battery Pack 48V", "Batteries", "piece", 450.0, 4, "METAL_SHIELDED"),
            ("SKU-1003", "Hydraulic Pressure Sensor", "Industrial", "piece", 185.0, 6, "CARDBOARD"),
            ("SKU-1004", "Thermal Receipt Printer", "Electronics", "piece", 210.0, 5, "CARDBOARD"),
            ("SKU-1005", "Microcontroller Dev Kit", "Electronics", "piece", 89.0, 10, "PLASTIC"),
            ("SKU-1006", "High-Torque Stepper Motor", "Automation", "piece", 145.0, 6, "CARDBOARD"),
            ("SKU-1007", "Fiber Optic Transceiver SFP+", "Networking", "piece", 75.0, 12, "PLASTIC"),
            ("SKU-1008", "Digital Precision Caliper", "Tools", "piece", 95.0, 8, "CARDBOARD"),
            ("SKU-1009", "RF Shielding Foil Enclosure", "Hardware", "roll", 130.0, 4, "METAL_SHIELDED"),
            ("SKU-1010", "Solid State Drive Enterprise 2TB", "Storage", "piece", 280.0, 7, "PLASTIC"),
            ("SKU-1011", "Industrial Ethernet Switch 8P", "Networking", "piece", 360.0, 3, "CARDBOARD"),
            ("SKU-1012", "Optical Distance Sensor Laser", "Automation", "piece", 240.0, 5, "CARDBOARD"),
            ("SKU-1013", "Servo Motor Controller 24V", "Automation", "piece", 195.0, 4, "CARDBOARD"),
            ("SKU-1014", "Pneumatic Solenoid Valve", "Fluidics", "piece", 115.0, 8, "CARDBOARD"),
            ("SKU-1015", "Rechargeable Lithium Cell 18650", "Batteries", "box", 160.0, 15, "LIQUID_PROXIMITY"),
        ]

        prod_objs = {}
        for sku, name, cat, unit, cost, min_s, def_pkg in products_info:
            p = db.query(Product).filter(Product.sku == sku).first()
            if not p:
                p = Product(sku=sku, name=name, category=cat, unit=unit, min_stock=min_s)
                db.add(p)
                db.flush()
            prod_objs[sku] = (p, def_pkg)

        # 5. Populate the 38 Physical RFID Tags & Inventory Items
        # Port 1 tags: Shelf A; Port 2 tags: Shelf B
        port1_known_epcs = {
            "30341ADB10521280257A10A9",
            "1A80B18C7809A71982647AC2",
            "FFFFFF000000000000000000",
            "3852"
        }

        for idx, epc in enumerate(GATEWAY_PHYSICAL_EPCS):
            sku_idx = (idx % len(products_info))
            sku = products_info[sku_idx][0]
            prod, def_pkg = prod_objs[sku]

            tag = RFIDTag(
                epc=epc,
                product_id=prod.id,
                status="ACTIVE",
                packaging_class=def_pkg,
                assigned_at=now - timedelta(days=14)
            )
            db.add(tag)
            db.flush()

            # Determine nominal shelf assignment based on physical detection
            if epc in port1_known_epcs:
                exp_shelf_code = "SHELF_A"
            else:
                exp_shelf_code = "SHELF_B"

            # Setup realistic operational states
            # EPC 1A80B18C7809A71982647AC2: Intentionally misplaced (Expected B, physically observed on A)
            if epc == "1A80B18C7809A71982647AC2":
                exp_shelf_code = "SHELF_B"
                phys_shelf_code = "SHELF_A"
                status = "MISPLACED"
                conf = 0.94
                is_pres = True
                is_shad = False
            elif epc == "E28011606000020788842D21":
                # Shadowed / Attenuated tag
                exp_shelf_code = "SHELF_B"
                phys_shelf_code = "SHELF_B"
                status = "POSSIBLE_UNREAD"
                conf = 0.88
                is_pres = True
                is_shad = True
            elif epc == "00000000000000A000009893":
                # Missing from active shelf
                exp_shelf_code = "SHELF_C"
                phys_shelf_code = None
                status = "LIKELY_MISSING"
                conf = 0.91
                is_pres = False
                is_shad = False
            elif epc == "FFFFFF000000000000000000":
                # Boundary read
                exp_shelf_code = "SHELF_A"
                phys_shelf_code = "SHELF_A"
                status = "AMBIGUOUS"
                conf = 0.72
                is_pres = True
                is_shad = False
            else:
                phys_shelf_code = exp_shelf_code
                status = "IN_PLACE"
                conf = 0.98
                is_pres = True
                is_shad = False

            exp_shelf = shelf_objs[exp_shelf_code]
            obs_shelf = shelf_objs[phys_shelf_code] if phys_shelf_code else None

            inv = Inventory(
                epc=epc,
                product_id=prod.id,
                expected_location_id=exp_shelf.id,
                observed_location_id=obs_shelf.id if (obs_shelf and status != "LIKELY_MISSING") else None,
                status=status,
                confidence=conf,
                last_reconciled_at=now,
                last_observed_at=now if is_pres and not is_shad else None
            )
            db.add(inv)
            db.flush()

            if status in ["MISPLACED", "POSSIBLE_UNREAD", "LIKELY_MISSING", "AMBIGUOUS"]:
                root_map = {
                    "MISPLACED": "PHYSICAL_RELOCATION",
                    "POSSIBLE_UNREAD": "RF_SHADOWING",
                    "LIKELY_MISSING": "PHYSICAL_RELOCATION",
                    "AMBIGUOUS": "PHYSICAL_RELOCATION"
                }
                disc = Discrepancy(
                    epc=epc,
                    discrepancy_type=status,
                    expected_location_id=exp_shelf.id,
                    observed_location_id=obs_shelf.id if obs_shelf else None,
                    confidence=conf,
                    root_cause=root_map[status],
                    status="AI_ANALYZED",
                    verification_required=True,
                    created_at=now - timedelta(minutes=30)
                )
                db.add(disc)
                db.flush()

                ai_p = AIPrediction(
                    discrepancy_id=disc.id,
                    model_name="Root-Cause & Location Fusion",
                    model_version="v1.2.0",
                    prediction=root_map[status],
                    score=conf,
                    evidence=[
                        f"Real antenna observations from Reader {settings.RFID_READER_ID}",
                        f"Expected shelf: {exp_shelf_code}",
                        f"Status: {status}"
                    ],
                    recommended_action=f"VERIFY_{phys_shelf_code or exp_shelf_code}",
                    created_at=now - timedelta(minutes=30)
                )
                db.add(ai_p)

        # 6. Sample movement history
        mov1 = InventoryMovement(
            epc="30341ADB10521280257A10A9",
            from_shelf_id=shelf_objs["SHELF_B"].id,
            to_shelf_id=shelf_objs["SHELF_A"].id,
            movement_type="AUTHORIZED_MOVE",
            authorized=1,
            authorized_by="Sarah Jenkins",
            notes="Restocked to fast-pick shelf A",
            timestamp=now - timedelta(hours=3)
        )
        mov2 = InventoryMovement(
            epc="1A80B18C7809A71982647AC2",
            from_shelf_id=shelf_objs["SHELF_B"].id,
            to_shelf_id=shelf_objs["SHELF_A"].id,
            movement_type="TRANSFER",
            authorized=0,
            authorized_by="Unknown Operator",
            notes="Moved without scanning pallet barcode in WMS",
            timestamp=now - timedelta(hours=1)
        )
        db.add_all([mov1, mov2])

        db.commit()
        print(f"Database seeded with 38 physical tags and live reader {settings.RFID_READER_ID}.")

        _seed_handheld_and_wms(db, now)

        # Ingest initial live telemetry from gateway history if reachable
        _ingest_gateway_history(db)

    finally:
        db.close()

def _ingest_gateway_history(db: Session):
    """Fetches telemetry history batches from Aperture gateway and populates rfid_events."""
    try:
        url = f"{settings.RFID_GATEWAY_URL}{settings.RFID_GATEWAY_HISTORY_ENDPOINT}"
        resp = httpx.get(url, timeout=5.0)
        if resp.status_code == 200:
            payload = resp.json()
            batches = payload.get("data", [])
            print(f"Fetched {len(batches)} history batches from live gateway.")
            
            inserted = 0
            for b in batches[-10:]:  # Last 10 batches
                batch_data = b.get("data", [])
                for item in batch_data:
                    epc = item.get("epc")
                    ant = item.get("ant", 1)
                    rssi_val = item.get("rssi", 70)
                    rssi_dbm = -abs(float(rssi_val)) if rssi_val is not None else -70.0
                    ts_str = item.get("timestamp")
                    try:
                        ts = datetime.fromisoformat(ts_str.replace(" ", "T")) if ts_str else datetime.now(timezone.utc)
                    except Exception:
                        ts = datetime.now(timezone.utc)
                    
                    event = RFIDEvent(
                        reader_id=1,
                        antenna_id=ant,
                        epc=epc,
                        rssi_dbm=rssi_dbm,
                        phase_angle_rad=0.0,
                        doppler_shift_hz=0.0,
                        read_count=item.get("count", 1),
                        source="PHYSICAL",
                        timestamp=ts
                    )
                    db.add(event)
                    inserted += 1
            db.commit()
            print(f"Ingested {inserted} live gateway events into database.")
    except Exception as e:
        print(f"Gateway telemetry history notice: {e}")

def _seed_handheld_and_wms(db: Session, now: datetime):
    try:
        # Seed Handheld Readers
        if db.query(HandheldDevice).count() == 0:
            hh1 = HandheldDevice(
                device_code="HH-01",
                model="Zebra TC26 / RFD40 UHF Sled",
                assigned_operator="Alex Rivera",
                status="ACTIVE",
                battery_level=94,
                ip_address="192.168.1.151",
                last_seen=now,
                created_at=now - timedelta(days=7)
            )
            hh2 = HandheldDevice(
                device_code="HH-02",
                model="Chainway C72 Rugged UHF",
                assigned_operator="Sarah Jenkins",
                status="IDLE",
                battery_level=88,
                ip_address="192.168.1.152",
                last_seen=now - timedelta(hours=2),
                created_at=now - timedelta(days=5)
            )
            db.add_all([hh1, hh2])
            db.flush()

        # Seed Handheld Scan Sessions
        if db.query(HandheldScanSession).count() == 0:
            hh = db.query(HandheldDevice).first()
            s1 = db.query(Shelf).filter(Shelf.shelf_code == "SHELF_A").first()
            s2 = db.query(Shelf).filter(Shelf.shelf_code == "SHELF_B").first() or s1
            ses1 = HandheldScanSession(
                session_code="SCAN-00104",
                device_id=hh.id if hh else None,
                operator_name="Marcus Vance",
                shelf_id=s1.id if s1 else None,
                target_shelf_code=s1.shelf_code if s1 else "SHELF_A",
                status="COMPLETED",
                scan_mode="DISCREPANCY_VERIFICATION",
                total_scans=38,
                unique_epcs=38,
                started_at=now - timedelta(hours=5),
                completed_at=now - timedelta(hours=4, minutes=45),
                notes="Ground truth physical verification of live UHF tags"
            )
            db.add(ses1)
            db.flush()

        # Seed WMS Inventory mirroring expected items
        if db.query(WMSInventory).count() == 0:
            inv_items = db.query(Inventory).all()
            for item in inv_items:
                sku = item.product.sku if item.product else "SKU-UNKNOWN"
                wms_item = WMSInventory(
                    epc=item.epc,
                    sku=sku,
                    product_id=item.product_id,
                    expected_shelf_id=item.expected_location_id,
                    quantity=1,
                    lot_number="LOT-2026-LIVE",
                    status="AVAILABLE",
                    updated_at=now
                )
                db.add(wms_item)
            db.flush()

        # Seed WMS Orders
        if db.query(WMSOrder).count() == 0:
            shelves = db.query(Shelf).all()
            s1 = shelves[0].id if shelves else 1
            s2 = shelves[1].id if len(shelves) > 1 else s1
            ord1 = WMSOrder(
                order_number="ORD-INB-101",
                order_type="INBOUND",
                status="COMPLETED",
                customer_or_vendor="Global Parts Logistics",
                created_at=now - timedelta(days=1),
                completed_at=now - timedelta(hours=12)
            )
            ord2 = WMSOrder(
                order_number="ORD-OUT-201",
                order_type="OUTBOUND",
                status="PROCESSING",
                customer_or_vendor="Apex Manufacturing Co.",
                created_at=now - timedelta(hours=3)
            )
            db.add_all([ord1, ord2])
            db.flush()

            line1 = WMSOrderLine(order_id=ord1.id, sku="SKU-1001", requested_quantity=1, fulfilled_quantity=1, target_shelf_id=s1)
            line2 = WMSOrderLine(order_id=ord2.id, sku="SKU-1004", requested_quantity=1, fulfilled_quantity=0, target_shelf_id=s2)
            db.add_all([line1, line2])
            db.flush()

        # Seed WMS Transactions
        if db.query(WMSTransaction).count() == 0:
            shelves = db.query(Shelf).all()
            s1 = shelves[0].id if shelves else 1
            tx1 = WMSTransaction(
                transaction_type="RECEIPT",
                epc="30341ADB10521280257A10A9",
                sku="SKU-1001",
                to_shelf_id=s1,
                quantity=1,
                user_name="Alex Rivera",
                reference_code="PO-44819",
                notes="Initial receipt from vendor container into Shelf A",
                timestamp=now - timedelta(days=1)
            )
            db.add(tx1)
            db.flush()

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Handheld & WMS seed notice: {e}")
