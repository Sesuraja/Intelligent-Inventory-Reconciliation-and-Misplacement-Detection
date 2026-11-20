import os
from datetime import datetime, timezone, timedelta
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
from app.rfid.reader_manager import reader_manager

def _migrate_schema():
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                # Ensure rfid_events.source column exists
                res = conn.execute(text("PRAGMA table_info(rfid_events)")).fetchall()
                col_names = [r[1] for r in res]
                if col_names and "source" not in col_names:
                    conn.execute(text("ALTER TABLE rfid_events ADD COLUMN source VARCHAR(20) DEFAULT 'SIMULATION'"))

                # Ensure observation_windows.source column exists
                res2 = conn.execute(text("PRAGMA table_info(observation_windows)")).fetchall()
                col_names2 = [r[1] for r in res2]
                if col_names2 and "source" not in col_names2:
                    conn.execute(text("ALTER TABLE observation_windows ADD COLUMN source VARCHAR(20) DEFAULT 'SIMULATION'"))

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
    """Initializes tables and populates realistic seed data for the warehouse system."""
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Warehouse).first():
            print("Database already contains seed data.")
            _seed_handheld_and_wms(db, datetime.now(timezone.utc))
            _sync_simulator_with_db(db)
            return

        print("Seeding initial warehouse, RFID hardware, inventory, and AI models...")
        now = datetime.now(timezone.utc)

        # 1. Roles & Users
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

        # 2. Warehouse, Zones, Shelves, Bins
        wh = Warehouse(
            name="Central Logistics Center #4",
            code="WH-MAIN-01",
            description="Smart UHF RFID automated distribution facility"
        )
        db.add(wh)
        db.flush()

        zone_a = Zone(warehouse_id=wh.id, name="Zone A (High-Velocity)", code="ZONE-A")
        zone_b = Zone(warehouse_id=wh.id, name="Zone B (Specialty Storage)", code="ZONE-B")
        db.add_all([zone_a, zone_b])
        db.flush()

        shelves_data = [
            ("SHELF_A", "Shelf A - Fast Pick", zone_a.id, 2.0, 1.0),
            ("SHELF_B", "Shelf B - Standard", zone_a.id, 5.0, 1.0),
            ("SHELF_C", "Shelf C - Overflow", zone_a.id, 8.0, 1.0),
            ("SHELF_D", "Shelf D - Specialty", zone_b.id, 12.0, 1.0),
        ]
        shelf_objs = {}
        for code, name, zid, cx, cy in shelves_data:
            s = Shelf(zone_id=zid, shelf_code=code, name=name, capacity=30, coord_x=cx, coord_y=cy)
            db.add(s)
            shelf_objs[code] = s
        db.flush()

        # 3. Fixed Reader & 4 Antennas
        reader = Reader(
            reader_code="READER_01",
            name="Fixed Portal Reader North",
            model="Impinj Speedway R420 (4-Port UHF)",
            ip_address="192.168.1.100",
            port=5084,
            protocol="LLRP",
            status="ONLINE",
            last_heartbeat=now,
            location_desc="Zone A & B Overhead Truss Mount"
        )
        db.add(reader)
        db.flush()

        antennas_data = [
            ("ANT-01", 1, shelf_objs["SHELF_A"].id, "Primary detection Shelf A"),
            ("ANT-02", 2, shelf_objs["SHELF_B"].id, "Primary detection Shelf B"),
            ("ANT-03", 3, shelf_objs["SHELF_C"].id, "Primary detection Shelf C"),
            ("ANT-04", 4, shelf_objs["SHELF_D"].id, "Specialty detection Shelf D"),
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

            # Calibration record
            cal = AntennaCalibration(
                antenna_id=ant.id,
                median_rssi_baseline=-42.0,
                noise_floor_dbm=-85.0,
                cross_read_leakage_dbm=-68.0,
                calibration_date=now - timedelta(days=2)
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
            p = Product(sku=sku, name=name, category=cat, unit=unit, unit_cost=cost, min_stock=min_s)
            db.add(p)
            prod_objs[sku] = (p, def_pkg)
        db.flush()

        # 5. RFID Tags & Inventory Items
        # We will create 24 inventory items across shelves A, B, C, D
        # We will deliberately setup realistic test scenarios:
        # - Most items: IN_PLACE
        # - EPC-9002: MISPLACED (Expected Shelf A, actually on Shelf C)
        # - EPC-9003: MISPLACED (Expected Shelf B, actually on Shelf A)
        # - EPC-9007: POSSIBLE_UNREAD (Expected Shelf B, Metal-shielded, RF shadowed)
        # - EPC-9015: LIKELY_MISSING (Expected Shelf C, physically absent from warehouse)
        # - EPC-9012: AMBIGUOUS (On boundary of Shelf A and B)

        tag_assignments = [
            ("EPC-9001", "SKU-1001", "SHELF_A", "SHELF_A", True, False, "CARDBOARD"),
            ("EPC-9002", "SKU-1002", "SHELF_A", "SHELF_C", True, False, "METAL_SHIELDED"),  # Misplaced!
            ("EPC-9003", "SKU-1003", "SHELF_B", "SHELF_A", True, False, "CARDBOARD"),        # Misplaced!
            ("EPC-9004", "SKU-1004", "SHELF_B", "SHELF_B", True, False, "CARDBOARD"),
            ("EPC-9005", "SKU-1005", "SHELF_B", "SHELF_B", True, False, "PLASTIC"),
            ("EPC-9006", "SKU-1006", "SHELF_A", "SHELF_A", True, False, "CARDBOARD"),
            ("EPC-9007", "SKU-1007", "SHELF_B", "SHELF_B", True, True, "LIQUID_PROXIMITY"), # Shadowed unread!
            ("EPC-9008", "SKU-1008", "SHELF_C", "SHELF_C", True, False, "CARDBOARD"),
            ("EPC-9009", "SKU-1009", "SHELF_C", "SHELF_C", True, False, "METAL_SHIELDED"),
            ("EPC-9010", "SKU-1010", "SHELF_C", "SHELF_C", True, False, "PLASTIC"),
            ("EPC-9011", "SKU-1011", "SHELF_D", "SHELF_D", True, False, "CARDBOARD"),
            ("EPC-9012", "SKU-1012", "SHELF_A", "SHELF_A", True, False, "CARDBOARD"),        # Boundary / Ambiguous
            ("EPC-9013", "SKU-1013", "SHELF_D", "SHELF_D", True, False, "CARDBOARD"),
            ("EPC-9014", "SKU-1014", "SHELF_A", "SHELF_A", True, False, "CARDBOARD"),
            ("EPC-9015", "SKU-1015", "SHELF_C", "SHELF_C", False, False, "LIQUID_PROXIMITY"),# Genuinely Missing!
            ("EPC-9016", "SKU-1001", "SHELF_B", "SHELF_B", True, False, "CARDBOARD"),
            ("EPC-9017", "SKU-1005", "SHELF_B", "SHELF_B", True, False, "PLASTIC"),
            ("EPC-9018", "SKU-1008", "SHELF_A", "SHELF_A", True, False, "CARDBOARD"),
            ("EPC-9019", "SKU-1010", "SHELF_C", "SHELF_C", True, False, "PLASTIC"),
            ("EPC-9020", "SKU-1012", "SHELF_D", "SHELF_D", True, False, "CARDBOARD"),
        ]

        sim = reader_manager.get_simulator()

        for epc, sku, exp_shelf_code, phys_shelf_code, is_pres, is_shad, pkg in tag_assignments:
            prod, _ = prod_objs[sku]
            tag = RFIDTag(
                epc=epc,
                product_id=prod.id,
                status="ACTIVE",
                packaging_class=pkg,
                assigned_at=now - timedelta(days=10)
            )
            db.add(tag)
            db.flush()

            exp_shelf = shelf_objs[exp_shelf_code]
            obs_shelf = shelf_objs[phys_shelf_code] if is_pres else None

            # Determine initial status
            if not is_pres:
                status = "LIKELY_MISSING"
                conf = 0.91
            elif is_shad:
                status = "POSSIBLE_UNREAD"
                conf = 0.88
            elif exp_shelf_code != phys_shelf_code:
                status = "MISPLACED"
                conf = 0.94
            elif epc == "EPC-9012":
                status = "AMBIGUOUS"
                conf = 0.68
            else:
                status = "IN_PLACE"
                conf = 0.98

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

            # If discrepancy, add discrepancy record and AI prediction
            if status in ["MISPLACED", "POSSIBLE_UNREAD", "LIKELY_MISSING", "AMBIGUOUS"]:
                root_map = {
                    "MISPLACED": "PHYSICAL_RELOCATION",
                    "POSSIBLE_UNREAD": "RF_SHADOWING",
                    "LIKELY_MISSING": "PHYSICAL_RELOCATION",
                    "AMBIGUOUS": "PHYSICAL_RELOCATION"
                }
                action_map = {
                    "MISPLACED": f"VERIFY_AND_CONFIRM_{phys_shelf_code}",
                    "POSSIBLE_UNREAD": "INSPECT_RF_SHADOWING_AND_REORIENT",
                    "LIKELY_MISSING": f"CYCLE_COUNT_AUDIT_AT_{exp_shelf_code}",
                    "AMBIGUOUS": "VERIFY_BOUNDARY_BETWEEN_SHELVES"
                }
                evidence_map = {
                    "MISPLACED": [
                        f"Repeated detections from antenna at {phys_shelf_code}",
                        "No authorized movement order found in WMS transaction log",
                        f"Expected shelf {exp_shelf_code} antenna reported 0 reads"
                    ],
                    "POSSIBLE_UNREAD": [
                        f"Tag packaging class '{pkg}' contains attenuating materials",
                        "Adjacent tags on the same shelf are successfully read",
                        "Absence of RF signal is consistent with RF shadowing"
                    ],
                    "LIKELY_MISSING": [
                        f"Zero detections logged across all warehouse antennas",
                        f"Expected location {exp_shelf_code} antenna is healthy (100% uptime)",
                        "Item confirmed physically unobserved over multiple scanning windows"
                    ],
                    "AMBIGUOUS": [
                        "Detections reported by both ANT-01 and ANT-02 with similar RSSI (-62 dBm vs -64 dBm)",
                        "RSSI separation delta (2.0 dB) is below the 6.0 dB disambiguation threshold",
                        "Placement on physical shelf divider boundary suspected"
                    ]
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
                    created_at=now - timedelta(minutes=45)
                )
                db.add(disc)
                db.flush()

                ai_p = AIPrediction(
                    discrepancy_id=disc.id,
                    model_name="Root-Cause & Location Fusion",
                    model_version="v1.2.0",
                    prediction=root_map[status],
                    score=conf,
                    evidence=evidence_map[status],
                    recommended_action=action_map[status],
                    created_at=now - timedelta(minutes=45)
                )
                db.add(ai_p)

            # Register tag in physical simulator
            sim.register_simulated_tag(
                epc=epc,
                physical_shelf=phys_shelf_code,
                is_present=is_pres,
                is_shadowed=is_shad,
                packaging=pkg
            )

        # 6. Sample movement history
        mov1 = InventoryMovement(
            epc="EPC-9001",
            from_shelf_id=shelf_objs["SHELF_B"].id,
            to_shelf_id=shelf_objs["SHELF_A"].id,
            movement_type="AUTHORIZED_MOVE",
            authorized=1,
            authorized_by="Sarah Jenkins",
            notes="Restocked to fast-pick shelf",
            timestamp=now - timedelta(hours=3)
        )
        mov2 = InventoryMovement(
            epc="EPC-9003",
            from_shelf_id=shelf_objs["SHELF_B"].id,
            to_shelf_id=shelf_objs["SHELF_A"].id,
            movement_type="TRANSFER",
            authorized=0,
            authorized_by="Unknown Operator",
            notes="Moved without scanning pallet barcode",
            timestamp=now - timedelta(hours=1)
        )
        db.add_all([mov1, mov2])

        db.commit()
        print("Database seeding completed successfully.")

        _seed_handheld_and_wms(db, now)

    finally:
        db.close()

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
                    lot_number="LOT-2026-A",
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
                epc="EPC-9001",
                sku="SKU-1001",
                to_shelf_id=s1,
                quantity=1,
                user_name="Alex Rivera",
                reference_code="PO-44819",
                notes="Initial receipt from vendor container",
                timestamp=now - timedelta(days=1)
            )
            db.add(tx1)
            db.flush()

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Handheld & WMS seed notice: {e}")

def _sync_simulator_with_db(db: Session):
    sim = reader_manager.get_simulator()
    # 1. Dynamically sync all shelves into simulator positions
    shelves = db.query(Shelf).all()
    for s in shelves:
        if s.shelf_code not in sim.shelf_positions:
            sim.shelf_positions[s.shelf_code] = s.coord_x if s.coord_x else (2.0 + s.id * 3.0)
    
    # 2. Dynamically sync active antenna-to-shelf mappings
    antennas = db.query(Antenna).all()
    for a in antennas:
        if a.shelf:
            sim.antenna_shelf_map[a.port_number] = a.shelf.shelf_code
            sim.antenna_id_map[a.port_number] = a.id

    # 3. Dynamically sync all inventory tags into physical simulation states
    items = db.query(Inventory).all()
    for it in items:
        shelf_code = it.observed_shelf.shelf_code if it.observed_shelf else (it.expected_shelf.shelf_code if it.expected_shelf else "SHELF_A")
        is_pres = (it.status != "LIKELY_MISSING")
        is_shad = (it.status == "POSSIBLE_UNREAD")
        pkg = it.tag.packaging_class if it.tag else "CARDBOARD"
        sim.register_simulated_tag(
            epc=it.epc,
            physical_shelf=shelf_code,
            is_present=is_pres,
            is_shadowed=is_shad,
            packaging=pkg
        )

