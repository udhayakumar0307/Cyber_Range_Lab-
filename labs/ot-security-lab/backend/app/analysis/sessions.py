def build_sessions(packets: list):
    active = {}
    sessions = []
    session_id = 1

    for packet in packets:
        protocol = packet.get("protocol", "UNKNOWN")
        operation = str(packet.get("operation", "")).lower()

        key = build_session_key(packet)
        reverse_key = build_reverse_key(packet)

        if is_response(packet):
            request = active.pop(reverse_key, None)

            if request:
                sessions.append(
                    make_session(
                        session_id=session_id,
                        request=request,
                        response=packet,
                        status="COMPLETE",
                    )
                )
                session_id += 1
            continue

        if is_request(packet):
            active[key] = packet

    for request in active.values():
        sessions.append(
            make_session(
                session_id=session_id,
                request=request,
                response=None,
                status="TIMEOUT",
            )
        )
        session_id += 1

    return sorted(sessions, key=lambda s: s.get("requestTime") or "")


def build_session_key(packet):
    protocol = packet.get("protocol", "UNKNOWN")
    source = packet.get("source")
    destination = packet.get("destination")

    if protocol == "Modbus TCP":
        return (
            protocol,
            source,
            destination,
            packet.get("transactionId"),
        )

    if protocol == "MQTT":
        return (
            protocol,
            source,
            destination,
            packet.get("topic", "unknown-topic"),
        )

    if protocol == "OPC UA":
        return (
            protocol,
            source,
            destination,
            packet.get("sessionId", packet.get("sourcePort")),
        )

    if protocol == "S7comm":
        return (
            protocol,
            source,
            destination,
            packet.get("pduReference", packet.get("sourcePort")),
        )

    if protocol == "DNP3":
        return (
            protocol,
            source,
            destination,
            packet.get("sequence", packet.get("sourcePort")),
        )

    if protocol == "EtherNet/IP":
        return (
            protocol,
            source,
            destination,
            packet.get("sessionHandle", packet.get("sourcePort")),
        )

    if protocol == "PROFINET":
        return (
            protocol,
            source,
            destination,
            packet.get("connectionId", packet.get("sourcePort")),
        )

    return (
        protocol,
        source,
        destination,
        packet.get("sourcePort"),
        packet.get("destinationPort"),
    )


def build_reverse_key(packet):
    protocol = packet.get("protocol", "UNKNOWN")
    source = packet.get("source")
    destination = packet.get("destination")

    if protocol == "Modbus TCP":
        return (
            protocol,
            destination,
            source,
            packet.get("transactionId"),
        )

    if protocol == "MQTT":
        return (
            protocol,
            destination,
            source,
            packet.get("topic", "unknown-topic"),
        )

    if protocol == "OPC UA":
        return (
            protocol,
            destination,
            source,
            packet.get("sessionId", packet.get("destinationPort")),
        )

    if protocol == "S7comm":
        return (
            protocol,
            destination,
            source,
            packet.get("pduReference", packet.get("destinationPort")),
        )

    if protocol == "DNP3":
        return (
            protocol,
            destination,
            source,
            packet.get("sequence", packet.get("destinationPort")),
        )

    if protocol == "EtherNet/IP":
        return (
            protocol,
            destination,
            source,
            packet.get("sessionHandle", packet.get("destinationPort")),
        )

    if protocol == "PROFINET":
        return (
            protocol,
            destination,
            source,
            packet.get("connectionId", packet.get("destinationPort")),
        )

    return (
        protocol,
        destination,
        source,
        packet.get("destinationPort"),
        packet.get("sourcePort"),
    )


def is_request(packet):
    operation = str(packet.get("operation", "")).lower()

    if "response" in operation:
        return False

    if "timeout" in operation:
        return False

    return True


def is_response(packet):
    operation = str(packet.get("operation", "")).lower()

    return (
        "response" in operation
        or "ack" in operation
        or "reply" in operation
    )


def make_session(session_id, request, response, status):
    latency = None

    if response:
        latency = response.get("latencyMs")

    return {
        "sessionId": session_id,
        "protocol": request.get("protocol"),
        "transactionId": request.get("transactionId"),
        "source": request.get("source"),
        "destination": request.get("destination"),
        "requestTime": request.get("timestamp"),
        "responseTime": response.get("timestamp") if response else None,
        "latencyMs": latency,
        "status": status,
        "operation": request.get("operation"),
        "functionCode": request.get("functionCode"),
        "register": request.get("register"),
        "value": request.get("value"),
        "requestSummary": request.get("summary"),
        "responseSummary": response.get("summary") if response else None,
    }
