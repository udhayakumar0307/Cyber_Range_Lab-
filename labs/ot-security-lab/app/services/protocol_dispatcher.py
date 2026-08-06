from app.services.protocols import modbus, dnp3

# SimulOT v2 intentionally supports only the two protocols taught in the lab.
DECODERS = [modbus, dnp3]


def decode_protocol(pkt):
    for decoder in DECODERS:
        result = decoder.decode(pkt)
        if result:
            return result

    return {
        "protocol": "UNKNOWN",
        "operation": "Unsupported or unclassified traffic",
    }
