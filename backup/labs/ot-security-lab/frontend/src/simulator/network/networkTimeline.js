import { decodePackets } from "./modbusDecoder";

export function buildNetworkTimeline(packetList = []) {
  const packets = decodePackets(packetList);

  return packets.map((packet, index) => ({
    id: `NET-${index}`,
    time: packet.timestamp,
    type: classifyPacket(packet),
    source: packet.source,
    destination: packet.destination,
    protocol: packet.protocol,
    operation: packet.operation,
    register: packet.register,
    value: packet.value,
    severity: packet.severity,
    description: buildDescription(packet),
  }));
}

function classifyPacket(packet) {
  if (packet.isWrite) return "WRITE";
  if (packet.isRead) return "READ";

  if ((packet.operation || "").toLowerCase().includes("response")) {
    return "RESPONSE";
  }

  if ((packet.protocol || "").toLowerCase().includes("heartbeat")) {
    return "HEARTBEAT";
  }

  return "NETWORK";
}

function buildDescription(packet) {
  if (packet.isWrite) {
    return `${packet.source} wrote ${packet.value} to ${packet.registerLabel}`;
  }

  if (packet.isRead) {
    return `${packet.source} read ${packet.registerLabel}`;
  }

  return `${packet.source} → ${packet.destination}: ${packet.operation}`;
}

export function getSuspiciousTimelineEvents(packetList = []) {
  return buildNetworkTimeline(packetList).filter(
    (event) => event.severity === "HIGH" || event.severity === "CRITICAL"
  );
}
