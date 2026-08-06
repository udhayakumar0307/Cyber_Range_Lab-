import { decodePackets } from "./modbusDecoder";

export function buildConversations(packetList = []) {
  const decodedPackets = decodePackets(packetList);

  const conversations = new Map();

  decodedPackets.forEach((packet) => {
    const key = buildConversationKey(packet);

    if (!conversations.has(key)) {
      conversations.set(key, {
        id: conversations.size + 1,

        source: packet.source,
        destination: packet.destination,

        protocol: packet.protocol,

        packets: [],

        packetCount: 0,

        firstSeen: packet.timestamp,
        lastSeen: packet.timestamp,

        duration: 0,

        bytes: 0,

        reads: 0,
        writes: 0,

        suspicious: false,

        functionCodes: new Set(),

        registers: new Set(),
      });
    }

    const conversation = conversations.get(key);

    conversation.packets.push(packet);

    conversation.packetCount++;

    conversation.lastSeen = packet.timestamp;

    conversation.bytes += estimatePacketSize(packet);

    if (packet.isRead) conversation.reads++;

    if (packet.isWrite) conversation.writes++;

    if (packet.functionCode !== null)
      conversation.functionCodes.add(packet.functionCode);

    if (packet.register)
      conversation.registers.add(packet.register);

    if (
      packet.severity === "HIGH" ||
      packet.severity === "CRITICAL"
    ) {
      conversation.suspicious = true;
    }
  });

  const list = Array.from(conversations.values());

  list.forEach((conversation) => {
    conversation.functionCodes = [...conversation.functionCodes];
    conversation.registers = [...conversation.registers];

    conversation.duration = calculateDuration(
      conversation.firstSeen,
      conversation.lastSeen
    );
  });

  return list.sort((a, b) => b.packetCount - a.packetCount);
}

function buildConversationKey(packet) {
  return [
    packet.source,
    packet.destination,
    packet.protocol,
  ].join("|");
}

function estimatePacketSize(packet) {
  let size = 54;

  if (packet.value) {
    size += JSON.stringify(packet.value).length;
  }

  return size;
}

function calculateDuration(firstSeen, lastSeen) {
  try {
    const start = convertTime(firstSeen);
    const end = convertTime(lastSeen);

    return Math.max(0, end - start);
  } catch {
    return 0;
  }
}

function convertTime(time) {
  if (!time) return 0;

  const parts = time.split(":");

  if (parts.length !== 3) return 0;

  return (
    Number(parts[0]) * 3600 +
    Number(parts[1]) * 60 +
    Number(parts[2])
  );
}

export function getConversationById(packetList, id) {
  return buildConversations(packetList).find(
    (conversation) => conversation.id === id
  );
}

export function getSuspiciousConversations(packetList) {
  return buildConversations(packetList).filter(
    (conversation) => conversation.suspicious
  );
}

export function getTopTalkers(packetList, limit = 5) {
  const conversations = buildConversations(packetList);

  return conversations
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, limit);
}

export function summarizeConversation(conversation) {
  if (!conversation) return null;

  return {
    id: conversation.id,

    source: conversation.source,

    destination: conversation.destination,

    protocol: conversation.protocol,

    packetCount: conversation.packetCount,

    reads: conversation.reads,

    writes: conversation.writes,

    suspicious: conversation.suspicious,

    registers: conversation.registers,

    functionCodes: conversation.functionCodes,

    duration: conversation.duration,

    bytes: conversation.bytes,
  };
}
