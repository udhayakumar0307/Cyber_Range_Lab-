import os
import time
import json

from scapy.all import (
    Ether,
    IP,
    TCP,
    UDP,
    Raw,
    wrpcap,
    ICMP,
    ARP,
)

try:
    from scapy.layers.snmp import SNMP, SNMPget, SNMPresponse, SNMPvarbind
    SNMP_AVAILABLE = True
except Exception:
    SNMP_AVAILABLE = False


REPORT_DIR = os.getenv("REPORT_DIR", "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

DEVICE_IPS = {
    "PLC01": "192.168.1.10",
    "HMI01": "192.168.1.20",
    "Historian01": "192.168.1.30",
    "SCADA01": "192.168.1.40",
    "EWS01": "192.168.1.50",
    "RTU01": "192.168.1.60",
    "NMS01": "192.168.1.70",
    "CloudBroker01": "192.168.1.80",
    "EngineeringPortal01": "192.168.1.90",
    "SW01": "192.168.1.2",
    "UNKNOWN": "192.168.1.250",
}

DEVICE_MACS = {
    "PLC01": "00:11:22:33:44:10",
    "HMI01": "00:11:22:33:44:20",
    "Historian01": "00:11:22:33:44:30",
    "SCADA01": "00:11:22:33:44:40",
    "EWS01": "00:11:22:33:44:50",
    "RTU01": "00:11:22:33:44:60",
    "NMS01": "00:11:22:33:44:70",
    "CloudBroker01": "00:11:22:33:44:80",
    "EngineeringPortal01": "00:11:22:33:44:90",
    "SW01": "00:11:22:33:44:02",
    "UNKNOWN": "aa:bb:cc:dd:ee:ff",
}

CLIENT_PORTS = {
    "HMI01": 51020,
    "Historian01": 51030,
    "SCADA01": 51040,
    "EWS01": 51050,
    "NMS01": 51070,
}

tcp_state = {}


def generate_pcap_from_packets(packets: list, filename: str = None):
    if not filename:
        filename = f"generated_capture_{int(time.time())}.pcap"

    file_path = os.path.join(REPORT_DIR, filename)
    scapy_packets = []

    for packet in packets:
        built = build_packet(packet)

        if isinstance(built, list):
            scapy_packets.extend(built)
        else:
            scapy_packets.append(built)

    wrpcap(file_path, scapy_packets)

    return {
        "filename": filename,
        "path": file_path,
        "packetCount": len(scapy_packets),
    }


def build_packet(packet: dict):
    src = packet.get("source", "UNKNOWN")
    dst = packet.get("destination", "UNKNOWN")

    src_ip = packet.get("sourceIp") or DEVICE_IPS.get(src, DEVICE_IPS["UNKNOWN"])
    dst_ip = packet.get("destinationIp") or DEVICE_IPS.get(dst, DEVICE_IPS["UNKNOWN"])

    src_mac = packet.get("sourceMac") or DEVICE_MACS.get(src, DEVICE_MACS["UNKNOWN"])
    dst_mac = packet.get("destinationMac") or DEVICE_MACS.get(dst, DEVICE_MACS["UNKNOWN"])

    protocol = packet.get("protocol", "UNKNOWN")

    if protocol == "ARP":
        return Ether(src=src_mac, dst="ff:ff:ff:ff:ff:ff") / ARP(
            op=1,
            hwsrc=src_mac,
            psrc=src_ip,
            hwdst="00:00:00:00:00:00",
            pdst=DEVICE_IPS["PLC01"],
        )

    if protocol == "ICMP":
        return Ether(src=src_mac, dst=dst_mac) / IP(src=src_ip, dst=dst_ip) / ICMP(type=8)

    if protocol == "SNMP":
        return build_snmp_packet(packet, src_ip, dst_ip, src_mac, dst_mac)

    payload = build_payload(packet)
    sport, dport = choose_ports(packet)

    transport = build_tcp_segment(
        src_ip=src_ip,
        dst_ip=dst_ip,
        sport=sport,
        dport=dport,
        payload_len=len(payload),
    )

    built_packet = (
        Ether(src=src_mac, dst=dst_mac)
        / IP(src=src_ip, dst=dst_ip)
        / transport
        / Raw(load=payload)
    )

    epoch_ms = packet.get("timestampEpochMs")
    if epoch_ms is not None:
        try:
            built_packet.time = float(epoch_ms) / 1000.0
        except (TypeError, ValueError):
            pass

    return built_packet


def choose_ports(packet: dict):
    protocol = packet.get("protocol", "UNKNOWN")
    source = packet.get("source", "UNKNOWN")
    operation = str(packet.get("operation", ""))

    server_port = int(packet.get("port") or guess_port(protocol))
    client_port = int(packet.get("clientPort") or CLIENT_PORTS.get(source) or CLIENT_PORTS.get(packet.get("destination")) or 51000)

    if protocol == "Modbus TCP":
        if "Response" in operation or source == "PLC01":
            return 502, client_port
        return client_port, 502

    if source in ["PLC01", "SW01", "CloudBroker01", "Historian01"] and "Response" in operation:
        return server_port, client_port

    return client_port, server_port


def build_tcp_segment(src_ip, dst_ip, sport, dport, payload_len):
    key = canonical_tcp_key(src_ip, dst_ip, sport, dport)

    if key not in tcp_state:
        tcp_state[key] = {
            "a_seq": 1000,
            "b_seq": 5000,
            "a": (src_ip, sport),
            "b": (dst_ip, dport),
        }

    state = tcp_state[key]
    is_a = (src_ip, sport) == state["a"]

    if is_a:
        seq = state["a_seq"]
        ack = state["b_seq"]
        state["a_seq"] += max(payload_len, 1)
    else:
        seq = state["b_seq"]
        ack = state["a_seq"]
        state["b_seq"] += max(payload_len, 1)

    return TCP(
        sport=sport,
        dport=dport,
        flags="PA",
        seq=seq,
        ack=ack,
    )


def canonical_tcp_key(src_ip, dst_ip, sport, dport):
    a = (src_ip, sport)
    b = (dst_ip, dport)

    if str(a) <= str(b):
        return (a, b)

    return (b, a)


def build_payload(packet: dict):
    protocol = packet.get("protocol", "UNKNOWN")

    if protocol == "HTTP":
        return build_http_get()

    if protocol == "MQTT":
        return build_mqtt_publish(
            topic=packet.get("topic", "plant/water/process"),
            message=json.dumps(packet.get("value", "normal")),
        )

    if protocol == "Modbus TCP":
        return build_modbus_payload(packet)

    if protocol == "DNP3":
        return build_dnp3_payload(packet)

    text_payload = {
        "protocol": protocol,
        "operation": packet.get("operation"),
        "source": packet.get("source"),
        "destination": packet.get("destination"),
        "register": packet.get("register"),
        "value": packet.get("value"),
        "severity": packet.get("severity"),
    }

    return json.dumps(text_payload).encode("utf-8")


def build_modbus_payload(packet: dict):
    transaction_id = int(packet.get("transactionId") or 1)
    protocol_id = 0
    unit_id = 1
    function_code = int(packet.get("functionCode") or 3)
    operation = str(packet.get("operation", ""))

    if "Response" in operation:
        pdu = build_modbus_response_pdu(packet, function_code)
    else:
        pdu = build_modbus_request_pdu(packet, function_code)

    length = len(pdu) + 1

    mbap = (
        transaction_id.to_bytes(2, "big")
        + protocol_id.to_bytes(2, "big")
        + length.to_bytes(2, "big")
        + unit_id.to_bytes(1, "big")
    )

    return mbap + pdu


def build_modbus_request_pdu(packet, function_code):
    register_number = first_register(packet.get("register"))
    modbus_address = max(0, register_number - 40001)

    if function_code == 6:
        value_number = safe_int(packet.get("value"), 0)

        return (
            function_code.to_bytes(1, "big")
            + modbus_address.to_bytes(2, "big")
            + value_number.to_bytes(2, "big")
        )

    if function_code == 16:
        writes = extract_writes(packet)
        if writes:
            start_register = first_register(writes[0].get("register"))
            modbus_address = max(0, start_register - 40001)
            values = [safe_int(write.get("value"), 0) & 0xFFFF for write in writes]
        else:
            values = [safe_int(v, 0) & 0xFFFF for v in packet.get("value", [])]

        quantity = len(values) or safe_int(packet.get("quantity"), 1)
        byte_count = quantity * 2

        return (
            function_code.to_bytes(1, "big")
            + modbus_address.to_bytes(2, "big")
            + quantity.to_bytes(2, "big")
            + byte_count.to_bytes(1, "big")
            + b"".join(v.to_bytes(2, "big") for v in values)
        )

    quantity = safe_int(packet.get("quantity"), 4)

    return (
        function_code.to_bytes(1, "big")
        + modbus_address.to_bytes(2, "big")
        + quantity.to_bytes(2, "big")
    )


def build_modbus_response_pdu(packet, function_code):
    if function_code == 3:
        values = extract_register_values(packet)
        byte_count = len(values) * 2

        return (
            function_code.to_bytes(1, "big")
            + byte_count.to_bytes(1, "big")
            + b"".join(v.to_bytes(2, "big", signed=False) for v in values)
        )

    if function_code == 6:
        return build_modbus_request_pdu(packet, function_code)

    if function_code == 16:
        writes = extract_writes(packet)
        register_number = first_register(writes[0].get("register")) if writes else first_register(packet.get("register"))
        modbus_address = max(0, register_number - 40001)
        quantity = len(writes) or safe_int(packet.get("quantity"), 1)

        return (
            function_code.to_bytes(1, "big")
            + modbus_address.to_bytes(2, "big")
            + quantity.to_bytes(2, "big")
        )

    return function_code.to_bytes(1, "big") + b"\x00"



def extract_writes(packet):
    payload = packet.get("payload") or {}

    if isinstance(payload, dict) and isinstance(payload.get("writes"), list):
        return payload.get("writes")

    value = packet.get("value")
    if isinstance(value, list) and all(isinstance(item, dict) for item in value):
        return value

    return []

def extract_register_values(packet):
    value = packet.get("value")

    if isinstance(value, list):
        return [safe_int(v, 0) & 0xFFFF for v in value]

    if isinstance(value, dict):
        ordered = [
            value.get("tankLevel", 0),
            value.get("flowRate", 0),
            value.get("temperature", 0),
            value.get("chemicalLevel", 0),
            value.get("valvePosition", 0),
            1 if value.get("pumpStatus") in ["ON", "RUNNING", 1, True] else 0,
        ]
        return [safe_int(round(float(v) * 10), 0) & 0xFFFF for v in ordered]

    quantity = safe_int(packet.get("quantity"), 4)
    return [0 for _ in range(quantity)]


def first_register(register):
    if register is None or register == "-":
        return 40001

    if isinstance(register, str):
        if "-" in register:
            return safe_int(register.split("-")[0], 40001)
        return safe_int(register, 40001)

    return safe_int(register, 40001)


def safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def build_dnp3_payload(packet: dict):
    """Build a compact, Wireshark-recognizable DNP3 link/application frame.

    This is intentionally limited to the Class 0 read request/response used by
    the training lab. CRC bytes are placeholders because Scapy does not ship a
    native DNP3 layer, but the start bytes, link header, transport control and
    application function are authentic enough for protocol identification.
    """
    source = packet.get("source", "SCADA01")
    destination = packet.get("destination", "RTU01")
    is_response = "Response" in str(packet.get("operation", ""))
    sequence = safe_int(packet.get("dnp3Sequence"), 0) & 0x0F
    app_function = safe_int(packet.get("dnp3FunctionCode"), 129 if is_response else 1) & 0xFF

    # Link-layer addresses: master=1, outstation=10.
    link_src = 10 if source == "RTU01" else 1
    link_dst = 1 if destination == "SCADA01" else 10
    link_control = 0x44 if is_response else 0xC4

    transport_control = 0xC0 | sequence  # FIR + FIN + sequence
    application_control = 0xC0 | sequence

    if is_response:
        # Application response + IIN + one analog input object (group 30 var 1).
        value = packet.get("value") or {}
        level = safe_int(round(float(value.get("remoteTankLevel", 0)) * 10), 0)
        app_data = bytes([application_control, app_function, 0x00, 0x00, 30, 1, 0x17, 0x01, 0x00]) + level.to_bytes(4, "little", signed=True)
    else:
        # READ request for class 0 data (group 60 variation 1).
        app_data = bytes([application_control, app_function, 60, 1, 0x06])

    user_data = bytes([transport_control]) + app_data
    length = 5 + len(user_data)
    header = (
        b"\x05\x64"
        + bytes([length & 0xFF, link_control])
        + link_dst.to_bytes(2, "little")
        + link_src.to_bytes(2, "little")
        + b"\x00\x00"
    )
    return header + user_data + b"\x00\x00"


def build_mqtt_publish(topic="plant/water/process", message="normal"):
    topic_bytes = topic.encode("utf-8")
    message_bytes = message.encode("utf-8")

    variable_header = len(topic_bytes).to_bytes(2, "big") + topic_bytes
    payload = message_bytes
    remaining_length = len(variable_header) + len(payload)

    return (
        bytes([0x30])
        + encode_mqtt_remaining_length(remaining_length)
        + variable_header
        + payload
    )


def encode_mqtt_remaining_length(length):
    encoded = bytearray()

    while True:
        digit = length % 128
        length //= 128

        if length > 0:
            digit |= 0x80

        encoded.append(digit)

        if length == 0:
            break

    return bytes(encoded)


def build_http_get():
    return (
        b"GET /dashboard HTTP/1.1\r\n"
        b"Host: engineering.local\r\n"
        b"User-Agent: SimulOT\r\n"
        b"Accept: */*\r\n"
        b"\r\n"
    )


def build_snmp_packet(packet, src_ip, dst_ip, src_mac, dst_mac):
    if not SNMP_AVAILABLE:
        return (
            Ether(src=src_mac, dst=dst_mac)
            / IP(src=src_ip, dst=dst_ip)
            / UDP(sport=161, dport=161)
            / Raw(load=b"SNMP")
        )

    oid = packet.get("oid", "1.3.6.1.2.1.1.1.0")
    operation = str(packet.get("operation", "")).upper()

    if operation == "RESPONSE":
        snmp = SNMP(
            community="public",
            PDU=SNMPresponse(
                varbindlist=[
                    SNMPvarbind(
                        oid=oid,
                        value=str(packet.get("value", "SimulOT")),
                    )
                ]
            ),
        )
    else:
        snmp = SNMP(
            community="public",
            PDU=SNMPget(
                varbindlist=[
                    SNMPvarbind(oid=oid)
                ]
            ),
        )

    return (
        Ether(src=src_mac, dst=dst_mac)
        / IP(src=src_ip, dst=dst_ip)
        / UDP(sport=161, dport=161)
        / snmp
    )


def guess_port(protocol: str):
    return {
        "Modbus TCP": 502,
        "DNP3": 20000,
    }.get(protocol, 502)
