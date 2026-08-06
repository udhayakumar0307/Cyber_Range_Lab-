from scapy.all import Raw, TCP

DNP3_PORT = 20000


def decode(pkt):
    if TCP not in pkt:
        return None

    tcp = pkt[TCP]
    if tcp.sport != DNP3_PORT and tcp.dport != DNP3_PORT:
        return None

    is_response = tcp.sport == DNP3_PORT
    result = {
        "protocol": "DNP3",
        "sourcePort": tcp.sport,
        "destinationPort": tcp.dport,
        "direction": "response" if is_response else "request",
        "operation": "DNP3 Response" if is_response else "DNP3 Request",
    }

    if Raw not in pkt:
        return result

    data = bytes(pkt[Raw].load)
    if len(data) < 13 or data[0:2] != b"\x05\x64":
        result["operation"] = "Malformed DNP3"
        return result

    result.update({
        "linkLength": data[2],
        "linkControl": data[3],
        "destinationAddress": int.from_bytes(data[4:6], "little"),
        "sourceAddress": int.from_bytes(data[6:8], "little"),
        "transportSequence": data[10] & 0x3F,
        "applicationControl": data[11],
        "applicationFunctionCode": data[12],
    })

    app_fc = data[12]
    if app_fc == 1:
        result["operation"] = "Class 0 Read Request"
    elif app_fc == 129:
        result["operation"] = "Class 0 Read Response"

    return result
