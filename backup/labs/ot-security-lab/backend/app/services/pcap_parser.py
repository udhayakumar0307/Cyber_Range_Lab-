from scapy.all import rdpcap, IP, TCP, UDP
from app.services.protocol_dispatcher import decode_protocol

def parse_pcap_file(file_path: str):
    packets = rdpcap(file_path)
    parsed = []

    for index, pkt in enumerate(packets[:500]):
        decoded = decode_protocol(pkt)

        item = {
            "index": index,
            "timestamp": str(float(pkt.time)),
            "source": "UNKNOWN",
            "destination": "UNKNOWN",
            "protocol": decoded.get("protocol", "UNKNOWN"),
            "operation": decoded.get("operation", "-"),
            "summary": pkt.summary(),
            **decoded,
        }

        if IP in pkt:
            item["source"] = pkt[IP].src
            item["destination"] = pkt[IP].dst

        if TCP in pkt:
            item["transport"] = "TCP"
            item["sourcePort"] = pkt[TCP].sport
            item["destinationPort"] = pkt[TCP].dport

        elif UDP in pkt:
            item["transport"] = "UDP"
            item["sourcePort"] = pkt[UDP].sport
            item["destinationPort"] = pkt[UDP].dport

        parsed.append(item)

    return parsed
