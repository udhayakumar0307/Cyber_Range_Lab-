from scapy.all import Raw, TCP


def decode(pkt):
    if TCP not in pkt:
        return None

    tcp = pkt[TCP]
    if tcp.sport != 502 and tcp.dport != 502:
        return None

    is_response = tcp.sport == 502
    result = {
        "protocol": "Modbus TCP",
        "sourcePort": tcp.sport,
        "destinationPort": tcp.dport,
        "direction": "response" if is_response else "request",
    }

    if Raw not in pkt:
        return result

    data = bytes(pkt[Raw].load)
    if len(data) < 8:
        result["operation"] = "Malformed Modbus TCP"
        return result

    transaction_id = int.from_bytes(data[0:2], "big")
    protocol_id = int.from_bytes(data[2:4], "big")
    length = int.from_bytes(data[4:6], "big")
    unit_id = data[6]
    function_code = data[7]

    result.update({
        "transactionId": transaction_id,
        "protocolId": protocol_id,
        "length": length,
        "unitId": unit_id,
        "functionCode": function_code,
        "operation": f"{function_name(function_code)} {'Response' if is_response else 'Request'}",
    })

    if function_code == 3:
        if is_response and len(data) >= 9:
            byte_count = data[8]
            values = []
            end = min(len(data), 9 + byte_count)
            for index in range(9, end - 1, 2):
                values.append(int.from_bytes(data[index:index + 2], "big"))
            result["byteCount"] = byte_count
            result["values"] = values
            result["quantity"] = len(values)
        elif not is_response and len(data) >= 12:
            result["registerOffset"] = int.from_bytes(data[8:10], "big")
            result["register"] = result["registerOffset"] + 40001
            result["quantity"] = int.from_bytes(data[10:12], "big")

    elif function_code == 6 and len(data) >= 12:
        result["registerOffset"] = int.from_bytes(data[8:10], "big")
        result["register"] = result["registerOffset"] + 40001
        result["value"] = int.from_bytes(data[10:12], "big")

    elif function_code == 16:
        if len(data) >= 12:
            result["registerOffset"] = int.from_bytes(data[8:10], "big")
            result["register"] = result["registerOffset"] + 40001
            result["quantity"] = int.from_bytes(data[10:12], "big")
        if not is_response and len(data) >= 13:
            result["byteCount"] = data[12]

    return result


def function_name(fc):
    return {
        3: "Read Holding Registers",
        6: "Write Single Register",
        16: "Write Multiple Registers",
    }.get(fc, "Unknown Function")
