import re
from typing import Dict, Any, Tuple

class EventValidator:
    """Validates raw and normalized RFID event data."""

    EPC_PATTERN = re.compile(r"^[A-Za-z0-9\-_]{4,64}$")
    MIN_RSSI_DBM = -95.0
    MAX_RSSI_DBM = -10.0

    @classmethod
    def validate_event(cls, data: Dict[str, Any]) -> Tuple[bool, str]:
        epc = data.get("epc")
        if not epc or not cls.EPC_PATTERN.match(str(epc)):
            return False, f"Invalid EPC syntax: {epc}"

        rssi = data.get("rssi_dbm")
        if rssi is None or not (cls.MIN_RSSI_DBM <= float(rssi) <= cls.MAX_RSSI_DBM):
            return False, f"RSSI {rssi} out of valid UHF range [{cls.MIN_RSSI_DBM}, {cls.MAX_RSSI_DBM}]"

        if "antenna_id" not in data or data["antenna_id"] is None:
            return False, "Missing antenna identifier"

        freq = data.get("frequency")
        if freq is not None and not (840.0 <= float(freq) <= 960.0):
            return False, f"UHF Frequency {freq} MHz out of global RFID band"

        return True, "Valid"

