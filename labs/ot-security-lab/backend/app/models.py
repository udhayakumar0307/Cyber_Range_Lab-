from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from .database import Base


class PacketCapture(Base):
    __tablename__ = "packet_captures"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    packet_count = Column(Integer, default=0)
    file_size = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class StoredPacket(Base):
    __tablename__ = "packets"

    id = Column(Integer, primary_key=True, index=True)
    capture_id = Column(Integer, ForeignKey("packet_captures.id"))

    packet_index = Column(Integer)
    timestamp = Column(String)

    source = Column(String)
    destination = Column(String)
    protocol = Column(String)
    operation = Column(String)

    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)

    function_code = Column(Integer, nullable=True)
    register = Column(String, nullable=True)
    value = Column(Text, nullable=True)

    summary = Column(Text)
