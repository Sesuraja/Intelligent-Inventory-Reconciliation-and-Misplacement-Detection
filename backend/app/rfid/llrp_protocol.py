"""
EPCglobal Low-Level Reader Protocol (LLRP) v1.0.1 Binary Framing & Codec.
Implements binary message encoding and decoding for UHF RFID 4-port readers
(e.g., Impinj Speedway R420, Alien F800, Zebra FX9600, ThingMagic Sargas).
"""

import struct
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone

# Standard LLRP Message Types
LLRP_MSG_GET_READER_CAPABILITIES = 1
LLRP_MSG_GET_READER_CAPABILITIES_RESPONSE = 11
LLRP_MSG_ADD_ROSPEC = 20
LLRP_MSG_ADD_ROSPEC_RESPONSE = 30
LLRP_MSG_DELETE_ROSPEC = 21
LLRP_MSG_START_ROSPEC = 22
LLRP_MSG_START_ROSPEC_RESPONSE = 32
LLRP_MSG_STOP_ROSPEC = 23
LLRP_MSG_STOP_ROSPEC_RESPONSE = 33
LLRP_MSG_ENABLE_ROSPEC = 24
LLRP_MSG_ENABLE_ROSPEC_RESPONSE = 34
LLRP_MSG_DISABLE_ROSPEC = 25
LLRP_MSG_RO_ACCESS_REPORT = 61
LLRP_MSG_KEEPALIVE = 62
LLRP_MSG_KEEPALIVE_ACK = 72
LLRP_MSG_READER_EVENT_NOTIFICATION = 63
LLRP_MSG_ENABLE_EVENTS_AND_REPORTS = 64
LLRP_MSG_CLOSE_CONNECTION = 14
LLRP_MSG_CLOSE_CONNECTION_RESPONSE = 4

# Standard LLRP Parameter Types (TLV: 10-bit types, TV: 7-bit types)
LLRP_PARAM_UTCTIMESTAMP = 128
LLRP_PARAM_GENERAL_DEVICE_CAPABILITIES = 137
LLRP_PARAM_ROSPEC = 177
LLRP_PARAM_RO_BOUNDARY_SPEC = 178
LLRP_PARAM_RO_SPEC_START_TRIGGER = 179
LLRP_PARAM_RO_SPEC_STOP_TRIGGER = 182
LLRP_PARAM_AI_SPEC = 183
LLRP_PARAM_AI_SPEC_STOP_TRIGGER = 184
LLRP_PARAM_INVENTORY_PARAMETER_SPEC = 186
LLRP_PARAM_ANTENNA_CONFIGURATION = 222
LLRP_PARAM_RF_RECEIVER = 223
LLRP_PARAM_RF_TRANSMITTER = 224
LLRP_PARAM_TAG_REPORT_DATA = 240
LLRP_PARAM_EPC_96 = 241
LLRP_PARAM_EPC_DATA = 242
LLRP_PARAM_PEAK_RSSI = 244
LLRP_PARAM_FIRST_SEEN_UTC = 245
LLRP_PARAM_LAST_SEEN_UTC = 246
LLRP_PARAM_TAG_SEEN_COUNT = 247
LLRP_PARAM_ANTENNA_ID = 248
LLRP_PARAM_CONNECTION_ATTEMPT_EVENT = 256

class LLRPProtocol:
    """Encodes and decodes standard EPCglobal binary LLRP messages."""

    HEADER_LEN = 10  # 2 bytes type/version + 4 bytes length + 4 bytes message ID

    @classmethod
    def encode_message(cls, msg_type: int, payload: bytes = b"", msg_id: int = 1) -> bytes:
        """
        Packs a 10-byte LLRP header + payload.
        Header:
          - Type & Reserved (2 bytes, big-endian) [Version: 3 bits (001), Type: 10 bits, Reserved: 3 bits]
          - Length (4 bytes, big-endian)
          - Message ID (4 bytes, big-endian)
        """
        type_field = 0x0400 | (msg_type & 0x03FF)
        msg_len = cls.HEADER_LEN + len(payload)
        header = struct.pack(">HII", type_field, msg_len, msg_id)
        return header + payload

    @classmethod
    def decode_header(cls, data: bytes) -> Optional[Tuple[int, int, int]]:
        """Extracts (msg_type, msg_len, msg_id) from first 10 bytes."""
        if len(data) < cls.HEADER_LEN:
            return None
        type_field, msg_len, msg_id = struct.unpack(">HII", data[:cls.HEADER_LEN])
        msg_type = type_field & 0x03FF
        return msg_type, msg_len, msg_id

    @classmethod
    def build_get_reader_capabilities(cls, msg_id: int = 1) -> bytes:
        """Requests reader capabilities (AllCapabilities = 0)."""
        payload = struct.pack(">B", 0)
        return cls.encode_message(LLRP_MSG_GET_READER_CAPABILITIES, payload, msg_id)

    @classmethod
    def build_add_rospec(
        cls,
        rospec_id: int = 1,
        antenna_ports: Optional[List[int]] = None,
        tx_power: float = 30.0,
        msg_id: int = 2
    ) -> bytes:
        """Builds ADD_ROSPEC message for inventorying across specified antenna ports."""
        if antenna_ports is None:
            antenna_ports = [1, 2, 3, 4]

        rospec_payload = struct.pack(">IBB", rospec_id, 0, 0)
        start_trig = struct.pack(">HB", 0x8000 | LLRP_PARAM_RO_SPEC_START_TRIGGER, 0)
        stop_trig = struct.pack(">HBI", 0x8000 | LLRP_PARAM_RO_SPEC_STOP_TRIGGER, 0, 0)
        boundary = struct.pack(">H", 0x8000 | LLRP_PARAM_RO_BOUNDARY_SPEC) + start_trig + stop_trig

        ant_data = struct.pack(">H", len(antenna_ports)) + b"".join(struct.pack(">H", p) for p in antenna_ports)
        ai_stop = struct.pack(">HBI", 0x8000 | LLRP_PARAM_AI_SPEC_STOP_TRIGGER, 0, 0)
        inv_param = struct.pack(">HHB", 0x8000 | LLRP_PARAM_INVENTORY_PARAMETER_SPEC, 1, 1)

        ai_spec = struct.pack(">H", 0x8000 | LLRP_PARAM_AI_SPEC) + ant_data + ai_stop + inv_param
        full_payload = rospec_payload + boundary + ai_spec
        return cls.encode_message(LLRP_MSG_ADD_ROSPEC, full_payload, msg_id)

    @classmethod
    def build_enable_rospec(cls, rospec_id: int = 1, msg_id: int = 3) -> bytes:
        return cls.encode_message(LLRP_MSG_ENABLE_ROSPEC, struct.pack(">I", rospec_id), msg_id)

    @classmethod
    def build_start_rospec(cls, rospec_id: int = 1, msg_id: int = 4) -> bytes:
        return cls.encode_message(LLRP_MSG_START_ROSPEC, struct.pack(">I", rospec_id), msg_id)

    @classmethod
    def build_stop_rospec(cls, rospec_id: int = 1, msg_id: int = 5) -> bytes:
        return cls.encode_message(LLRP_MSG_STOP_ROSPEC, struct.pack(">I", rospec_id), msg_id)

    @classmethod
    def build_keepalive_ack(cls, msg_id: int = 1) -> bytes:
        return cls.encode_message(LLRP_MSG_KEEPALIVE_ACK, b"", msg_id)

    @classmethod
    def parse_ro_access_report(cls, data: bytes) -> List[Dict[str, Any]]:
        """
        Parses an incoming RO_ACCESS_REPORT message and extracts real RFID observations:
        EPC, Antenna Port, Peak RSSI, and Observed Timestamp.
        """
        observations = []
        if len(data) < cls.HEADER_LEN:
            return observations

        offset = cls.HEADER_LEN
        total_len = len(data)
        now_utc = datetime.now(timezone.utc)

        while offset + 4 <= total_len:
            hdr, = struct.unpack(">H", data[offset:offset + 2])
            is_tv = bool(hdr & 0x8000)

            if is_tv:
                param_len = 2
                offset += param_len
                continue

            param_type = hdr & 0x03FF
            param_len, = struct.unpack(">H", data[offset + 2:offset + 4])
            if param_len < 4 or offset + param_len > total_len:
                break

            param_body = data[offset + 4:offset + param_len]
            offset += param_len

            if param_type == LLRP_PARAM_TAG_REPORT_DATA:
                tag_obs = cls._parse_tag_report_data(param_body, now_utc)
                if tag_obs:
                    observations.append(tag_obs)

        return observations

    @classmethod
    def _parse_tag_report_data(cls, body: bytes, default_time: datetime) -> Optional[Dict[str, Any]]:
        """Extracts individual EPC, antenna ID, and RSSI fields from TagReportData."""
        epc = None
        antenna_id = 1
        rssi_dbm = -60.0
        seen_count = 1
        observed_time = default_time

        offset = 0
        b_len = len(body)

        while offset + 2 <= b_len:
            hdr, = struct.unpack(">H", body[offset:offset + 2])
            is_tv = bool(hdr & 0x8000)

            if is_tv:
                # TV Parameter: 1 bit flag (1) + 7 bits type, followed by 1 byte value
                p_type = (hdr >> 8) & 0x7F
                val = hdr & 0xFF
                offset += 2

                if p_type == (LLRP_PARAM_ANTENNA_ID & 0x7F):
                    antenna_id = val
                elif p_type == (LLRP_PARAM_PEAK_RSSI & 0x7F):
                    signed_val = val if val < 128 else (val - 256)
                    rssi_dbm = float(signed_val)
                elif p_type == (LLRP_PARAM_TAG_SEEN_COUNT & 0x7F):
                    seen_count = val
                continue

            # TLV Parameter: 6 bits reserved, 10 bits type, 16 bits length
            p_type = hdr & 0x03FF
            if offset + 4 > b_len:
                break
            p_len, = struct.unpack(">H", body[offset + 2:offset + 4])
            if p_len < 4 or offset + p_len > b_len:
                break
            p_data = body[offset + 4:offset + p_len]
            offset += p_len

            if p_type == LLRP_PARAM_EPC_96 and len(p_data) >= 12:
                epc = p_data[:12].hex().upper()
            elif p_type == LLRP_PARAM_EPC_DATA and len(p_data) >= 2:
                bit_len, = struct.unpack(">H", p_data[:2])
                byte_len = (bit_len + 7) // 8
                epc = p_data[2:2 + byte_len].hex().upper()
            elif p_type == LLRP_PARAM_ANTENNA_ID:
                if len(p_data) >= 2:
                    antenna_id, = struct.unpack(">H", p_data[:2])
                elif len(p_data) == 1:
                    antenna_id = p_data[0]
            elif p_type == LLRP_PARAM_PEAK_RSSI and len(p_data) >= 1:
                signed_rssi, = struct.unpack(">b", p_data[:1])
                rssi_dbm = float(signed_rssi)
            elif p_type == LLRP_PARAM_TAG_SEEN_COUNT and len(p_data) >= 2:
                seen_count, = struct.unpack(">H", p_data[:2])

        if epc:
            return {
                "epc": epc,
                "antenna_port": antenna_id,
                "rssi_dbm": rssi_dbm,
                "read_count": seen_count,
                "observed_at": observed_time.isoformat(),
                "source": "PHYSICAL"
            }
        return None
