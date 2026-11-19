import pytest
import struct
from app.rfid.llrp_protocol import (
    LLRPProtocol,
    LLRP_MSG_GET_READER_CAPABILITIES,
    LLRP_MSG_ADD_ROSPEC,
    LLRP_MSG_START_ROSPEC,
    LLRP_MSG_STOP_ROSPEC,
    LLRP_MSG_KEEPALIVE_ACK,
    LLRP_MSG_RO_ACCESS_REPORT,
    LLRP_PARAM_TAG_REPORT_DATA,
    LLRP_PARAM_EPC_96,
    LLRP_PARAM_ANTENNA_ID,
    LLRP_PARAM_PEAK_RSSI
)
from app.rfid.operating_mode import mode_manager, OperatingMode
from app.rfid.reader_manager import reader_manager
from app.rfid.llrp_adapter import LLRPReaderAdapter
from app.rfid.event_normalizer import EventNormalizer

def test_llrp_header_encoding_and_decoding():
    msg = LLRPProtocol.build_get_reader_capabilities(msg_id=42)
    assert len(msg) >= 10
    header = LLRPProtocol.decode_header(msg)
    assert header is not None
    msg_type, msg_len, msg_id = header
    assert msg_type == LLRP_MSG_GET_READER_CAPABILITIES
    assert msg_len == len(msg)
    assert msg_id == 42

def test_llrp_rospec_messages():
    add_msg = LLRPProtocol.build_add_rospec(rospec_id=1, antenna_ports=[1, 2, 3, 4], msg_id=10)
    assert len(add_msg) > 10
    hdr = LLRPProtocol.decode_header(add_msg)
    assert hdr[0] == LLRP_MSG_ADD_ROSPEC
    assert hdr[2] == 10

    start_msg = LLRPProtocol.build_start_rospec(rospec_id=1, msg_id=11)
    hdr_start = LLRPProtocol.decode_header(start_msg)
    assert hdr_start[0] == LLRP_MSG_START_ROSPEC

    stop_msg = LLRPProtocol.build_stop_rospec(rospec_id=1, msg_id=12)
    hdr_stop = LLRPProtocol.decode_header(stop_msg)
    assert hdr_stop[0] == LLRP_MSG_STOP_ROSPEC

def test_llrp_parse_ro_access_report():
    # Construct a synthetic binary RO_ACCESS_REPORT message with a 96-bit EPC, antenna port 2, and RSSI -48 dBm
    epc_hex = "E28011700000020123456789"
    epc_bytes = bytes.fromhex(epc_hex)

    # Build TagReportData parameter
    # EPC_96 parameter: type (2 bytes), len (2 bytes), 12 bytes EPC
    epc_param = struct.pack(">HH", LLRP_PARAM_EPC_96, 16) + epc_bytes
    # Antenna ID parameter (TLV: type 248, len 6, port 2)
    ant_param = struct.pack(">HHH", LLRP_PARAM_ANTENNA_ID, 6, 2)
    # Peak RSSI: TV parameter (signed byte -48)
    rssi_param = struct.pack(">BB", 0x80 | (LLRP_PARAM_PEAK_RSSI & 0x7F), 208)

    tag_body = epc_param + ant_param + rssi_param
    tag_report_param = struct.pack(">HH", LLRP_PARAM_TAG_REPORT_DATA, 4 + len(tag_body)) + tag_body

    msg = LLRPProtocol.encode_message(LLRP_MSG_RO_ACCESS_REPORT, tag_report_param, msg_id=100)
    obs_list = LLRPProtocol.parse_ro_access_report(msg)

    assert len(obs_list) == 1
    obs = obs_list[0]
    assert obs["epc"] == epc_hex
    assert obs["antenna_port"] == 2
    assert obs["source"] == "PHYSICAL"

def test_operating_mode_isolation():
    # Verify SIMULATION mode routes to simulator
    mode_manager.set_mode(OperatingMode.SIMULATION)
    assert mode_manager.current_mode == OperatingMode.SIMULATION
    sim_adapter = reader_manager.get_active_adapter()
    assert sim_adapter is not None
    assert sim_adapter.reader_code == "READER_01"

    # Verify PHYSICAL mode routes to LLRP adapter
    mode_manager.set_mode(OperatingMode.PHYSICAL)
    assert mode_manager.current_mode == OperatingMode.PHYSICAL
    phys_adapter = reader_manager.get_active_adapter()
    assert isinstance(phys_adapter, LLRPReaderAdapter)

    # Verify OFFLINE mode suspends active adapter
    mode_manager.set_mode(OperatingMode.OFFLINE)
    assert mode_manager.current_mode == OperatingMode.OFFLINE
    assert reader_manager.get_active_adapter() is None

    # Reset back to SIMULATION
    mode_manager.set_mode(OperatingMode.SIMULATION)

@pytest.mark.asyncio
async def test_physical_reader_probe_unreachable():
    # Testing an unreachable physical reader must return reachable=False without crashing or false claims
    adapter = LLRPReaderAdapter(
        reader_code="TEST_READER",
        ip_address="127.0.0.1",
        port=59999,  # Non-listening port
        connect_timeout_sec=0.5
    )
    result = await adapter.test_physical_connection(timeout_sec=0.5)
    assert result["reachable"] is False
    assert result["success"] is False
    assert "unreachable" in result["message"].lower() or "error" in result

def test_event_normalizer_source_tagging():
    raw_sim = {
        "epc": "EPC-TEST-001",
        "rssi_dbm": -52.0,
        "antenna_port": 1
    }
    norm_sim = EventNormalizer.normalize(raw_sim, reader_code="READER_01", antenna_id=1, source="SIMULATION")
    assert norm_sim["source"] == "SIMULATION"
    assert norm_sim["valid"] is True

    raw_phys = {
        "epc": "EPC-TEST-002",
        "rssi_dbm": -45.0,
        "antenna_port": 2,
        "source": "PHYSICAL"
    }
    norm_phys = EventNormalizer.normalize(raw_phys, reader_code="READER_01", antenna_id=2, source="PHYSICAL")
    assert norm_phys["source"] == "PHYSICAL"
    assert norm_phys["valid"] is True
