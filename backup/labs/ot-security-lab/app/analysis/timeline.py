def build_timeline(packets: list):
    timeline = []

    for index, packet in enumerate(packets):
        timeline.append({
            "id": f"NET-{index}",
            "time": packet.get("timestamp"),
            "type": classify_packet(packet),
            "severity": classify_severity(packet),
            "source": packet.get("source"),
            "destination": packet.get("destination"),
            "protocol": packet.get("protocol"),
            "operation": packet.get("operation"),
            "functionCode": packet.get("functionCode"),
            "register": packet.get("register"),
            "value": packet.get("value"),
            "description": build_description(packet),
            "packetIndex": index,
        })

    return timeline


def classify_packet(packet):
    operation = str(packet.get("operation", "")).lower()
    fc = packet.get("functionCode")

    if "timeout" in operation:
        return "TIMEOUT"

    if "response" in operation or "reply" in operation:
        return "RESPONSE"

    if fc in [5, 6, 15, 16] or "write" in operation:
        return "WRITE"

    if fc in [1, 2, 3, 4] or "read" in operation:
        return "READ"

    if packet.get("protocol") in ["ARP", "ICMP", "SNMP"]:
        return packet.get("protocol")

    return "NETWORK"


def classify_severity(packet):
    operation = str(packet.get("operation", "")).lower()
    fc = packet.get("functionCode")
    source = packet.get("source")

    if "timeout" in operation:
        return "HIGH"

    if fc in [5, 6, 15, 16] and source not in ["HMI01", "192.168.1.20"]:
        return "HIGH"

    if packet.get("protocol") == "UNKNOWN":
        return "MEDIUM"

    return "INFO"


def build_description(packet):
    source = packet.get("source")
    destination = packet.get("destination")
    protocol = packet.get("protocol")
    operation = packet.get("operation")
    register = packet.get("register")
    value = packet.get("value")

    if register is not None:
        return f"{source} → {destination}: {operation} register {register} value {value}"

    return f"{source} → {destination}: {protocol} {operation}"
