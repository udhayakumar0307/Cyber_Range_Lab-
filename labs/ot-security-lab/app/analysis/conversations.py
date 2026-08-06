def build_conversations(packets: list):
    conversations = {}

    for packet in packets:
        source = packet.get("source", "UNKNOWN")
        destination = packet.get("destination", "UNKNOWN")
        protocol = packet.get("protocol", "UNKNOWN")

        key = f"{source}|{destination}|{protocol}"

        if key not in conversations:
            conversations[key] = {
                "source": source,
                "destination": destination,
                "protocol": protocol,
                "packetCount": 0,
                "reads": 0,
                "writes": 0,
                "responses": 0,
                "registers": {},
                "functionCodes": {},
            }

        conv = conversations[key]
        conv["packetCount"] += 1

        operation = str(packet.get("operation", "")).lower()
        function_code = packet.get("functionCode")
        register = packet.get("register")

        if "read" in operation:
            conv["reads"] += 1

        if "write" in operation:
            conv["writes"] += 1

        if "response" in operation:
            conv["responses"] += 1

        if function_code is not None:
            fc = str(function_code)
            conv["functionCodes"][fc] = conv["functionCodes"].get(fc, 0) + 1

        if register is not None:
            reg = str(register)
            conv["registers"][reg] = conv["registers"].get(reg, 0) + 1

    result = list(conversations.values())
    result.sort(key=lambda item: item["packetCount"], reverse=True)

    return result
