CONTROL_WRITE_FUNCTIONS = [5, 6, 15, 16]
NORMAL_WRITERS = ["HMI01", "192.168.1.20"]

CRITICAL_REGISTERS = {
    "40010": "Valve Position",
    "40020": "Pump Command",
    "40030": "Heater Command",
    "40040": "Chemical Target",
}


def detect_iocs(packets: list):
    findings = []

    findings.extend(detect_unauthorized_writes(packets))
    findings.extend(detect_modbus_scan(packets))
    findings.extend(detect_replay(packets))
    findings.extend(detect_timeouts(packets))
    findings.extend(detect_unknown_sources(packets))

    return findings


def detect_unauthorized_writes(packets):
    findings = []

    for index, packet in enumerate(packets):
        fc = packet.get("functionCode")
        source = packet.get("source")
        register = str(packet.get("register")) if packet.get("register") else None

        if fc in CONTROL_WRITE_FUNCTIONS and source not in NORMAL_WRITERS:
            findings.append({
                "id": f"IOC-WRITE-{index}",
                "severity": "HIGH",
                "title": "Unauthorized Control Write",
                "description": f"{source} wrote to PLC register {register}.",
                "packetIndex": index,
                "source": source,
                "destination": packet.get("destination"),
                "functionCode": fc,
                "register": register,
                "asset": CRITICAL_REGISTERS.get(register, "Unknown"),
            })

    return findings


def detect_modbus_scan(packets):
    findings = []
    reads_by_source = {}

    for index, packet in enumerate(packets):
        if packet.get("protocol") != "Modbus TCP":
            continue

        operation = str(packet.get("operation", "")).lower()

        if "read" not in operation:
            continue

        source = packet.get("source", "UNKNOWN")

        if source not in reads_by_source:
            reads_by_source[source] = {
                "count": 0,
                "firstIndex": index,
            }

        reads_by_source[source]["count"] += 1

    for source, data in reads_by_source.items():
        if source not in NORMAL_WRITERS and data["count"] >= 10:
            findings.append({
                "id": f"IOC-SCAN-{source}",
                "severity": "MEDIUM",
                "title": "Possible Modbus Scan",
                "description": f"{source} issued {data['count']} Modbus read requests.",
                "packetIndex": data["firstIndex"],
                "source": source,
            })

    return findings


def detect_replay(packets):
    findings = []
    seen = {}

    for index, packet in enumerate(packets):
        fc = packet.get("functionCode")

        if fc not in CONTROL_WRITE_FUNCTIONS:
            continue

        key = (
            packet.get("source"),
            packet.get("destination"),
            packet.get("functionCode"),
            str(packet.get("register")),
            str(packet.get("value")),
        )

        if key not in seen:
            seen[key] = []

        seen[key].append(index)

    for key, indexes in seen.items():
        if len(indexes) >= 2:
            findings.append({
                "id": f"IOC-REPLAY-{indexes[0]}",
                "severity": "MEDIUM",
                "title": "Possible Replay Activity",
                "description": "Identical control write appeared multiple times.",
                "packetIndex": indexes[0],
                "count": len(indexes),
            })

    return findings


def detect_timeouts(packets):
    findings = []

    for index, packet in enumerate(packets):
        operation = str(packet.get("operation", "")).lower()

        if "timeout" in operation:
            findings.append({
                "id": f"IOC-TIMEOUT-{index}",
                "severity": "HIGH",
                "title": "PLC Communication Timeout",
                "description": "PLC did not respond to a request.",
                "packetIndex": index,
                "source": packet.get("source"),
                "destination": packet.get("destination"),
            })

    return findings


def detect_unknown_sources(packets):
    findings = []

    for index, packet in enumerate(packets):
        source = packet.get("source")

        if source in ["UNKNOWN", "192.168.1.250"]:
            findings.append({
                "id": f"IOC-UNKNOWN-{index}",
                "severity": "MEDIUM",
                "title": "Unknown Source Device",
                "description": "Packet originated from an unknown device.",
                "packetIndex": index,
                "source": source,
                "destination": packet.get("destination"),
            })

    return findings
