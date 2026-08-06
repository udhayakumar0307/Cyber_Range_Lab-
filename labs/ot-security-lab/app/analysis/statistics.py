from collections import Counter


def build_statistics(packets: list):
    total_packets = len(packets)

    protocols = Counter()
    sources = Counter()
    destinations = Counter()
    function_codes = Counter()
    registers = Counter()

    modbus_packets = 0
    reads = 0
    writes = 0
    responses = 0
    unknown_packets = 0

    for packet in packets:
        protocol = packet.get("protocol", "UNKNOWN")
        source = packet.get("source", "UNKNOWN")
        destination = packet.get("destination", "UNKNOWN")
        operation = packet.get("operation", "")
        function_code = packet.get("functionCode")
        register = packet.get("register")

        protocols[protocol] += 1
        sources[source] += 1
        destinations[destination] += 1

        if protocol == "UNKNOWN":
            unknown_packets += 1

        if protocol == "Modbus TCP":
            modbus_packets += 1

        if function_code is not None:
            function_codes[str(function_code)] += 1

        if register is not None:
            registers[str(register)] += 1

        operation_lower = str(operation).lower()

        if "read" in operation_lower:
            reads += 1

        if "write" in operation_lower:
            writes += 1

        if "response" in operation_lower:
            responses += 1

    return {
        "totalPackets": total_packets,
        "modbusPackets": modbus_packets,
        "reads": reads,
        "writes": writes,
        "responses": responses,
        "unknownPackets": unknown_packets,
        "protocols": dict(protocols),
        "sources": dict(sources),
        "destinations": dict(destinations),
        "functionCodes": dict(function_codes),
        "registers": dict(registers),
        "topSources": counter_to_list(sources),
        "topDestinations": counter_to_list(destinations),
        "topProtocols": counter_to_list(protocols),
        "topRegisters": counter_to_list(registers),
    }


def counter_to_list(counter, limit=10):
    return [
        {"name": key, "count": count}
        for key, count in counter.most_common(limit)
    ]
