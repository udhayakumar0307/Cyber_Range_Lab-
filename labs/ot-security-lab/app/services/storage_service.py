import json
from app.database import SessionLocal
from app.models import PacketCapture, StoredPacket


def save_capture(filename: str, file_size: int, packets: list):
    db = SessionLocal()

    try:
        capture = PacketCapture(
            filename=filename,
            packet_count=len(packets),
            file_size=file_size,
        )

        db.add(capture)
        db.commit()
        db.refresh(capture)

        for packet in packets:
            stored_packet = StoredPacket(
                capture_id=capture.id,
                packet_index=packet.get("index"),
                timestamp=packet.get("timestamp"),
                source=packet.get("source"),
                destination=packet.get("destination"),
                protocol=packet.get("protocol"),
                operation=packet.get("operation"),
                source_port=packet.get("sourcePort"),
                destination_port=packet.get("destinationPort"),
                function_code=packet.get("functionCode"),
                register=str(packet.get("register")) if packet.get("register") is not None else None,
                value=json.dumps(packet.get("value")) if packet.get("value") is not None else None,
                summary=packet.get("summary"),
            )

            db.add(stored_packet)

        db.commit()

        return capture.id

    finally:
        db.close()


def list_captures():
    db = SessionLocal()

    try:
        captures = (
            db.query(PacketCapture)
            .order_by(PacketCapture.created_at.desc())
            .all()
        )

        return [
            {
                "id": c.id,
                "filename": c.filename,
                "packetCount": c.packet_count,
                "fileSize": c.file_size,
                "createdAt": c.created_at.isoformat(),
            }
            for c in captures
        ]

    finally:
        db.close()


def get_capture_packets(capture_id: int):
    db = SessionLocal()

    try:
        capture = db.query(PacketCapture).filter(PacketCapture.id == capture_id).first()

        if not capture:
            return None

        packets = (
            db.query(StoredPacket)
            .filter(StoredPacket.capture_id == capture_id)
            .order_by(StoredPacket.packet_index.asc())
            .all()
        )

        return {
            "id": capture.id,
            "filename": capture.filename,
            "packetCount": capture.packet_count,
            "fileSize": capture.file_size,
            "createdAt": capture.created_at.isoformat(),
            "packets": [
                {
                    "index": p.packet_index,
                    "timestamp": p.timestamp,
                    "source": p.source,
                    "destination": p.destination,
                    "protocol": p.protocol,
                    "operation": p.operation,
                    "sourcePort": p.source_port,
                    "destinationPort": p.destination_port,
                    "functionCode": p.function_code,
                    "register": p.register,
                    "value": p.value,
                    "summary": p.summary,
                }
                for p in packets
            ],
        }

    finally:
        db.close()
