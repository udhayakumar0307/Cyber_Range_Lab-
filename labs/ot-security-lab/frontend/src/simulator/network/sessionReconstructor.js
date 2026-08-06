import { decodePackets } from "./modbusDecoder";

export function reconstructSessions(packetList = []) {
  const packets = decodePackets(packetList);

  const sessions = [];
  let sessionId = 1;

  const pendingRequests = [];

  packets.forEach((packet) => {
    if (packet.isRead || packet.isWrite) {
      pendingRequests.push({
        id: sessionId++,
        request: packet,
        response: null,
      });
      return;
    }

    const request = pendingRequests.find(
      (r) =>
        !r.response &&
        r.request.destination === packet.source &&
        r.request.source === packet.destination
    );

    if (request) {
      request.response = packet;
    }
  });

  pendingRequests.forEach((entry) => {
    sessions.push(buildSession(entry));
  });

  return sessions;
}

function buildSession(entry) {
  const request = entry.request;
  const response = entry.response;

  return {
    sessionId: entry.id,

    protocol: request.protocol,

    source: request.source,
    destination: request.destination,

    requestTime: request.timestamp,
    responseTime: response?.timestamp ?? null,

    functionCode: request.functionCode,
    functionName: request.functionName,

    register: request.register,
    registerLabel: request.registerLabel,

    valueWritten: request.isWrite ? request.value : null,
    valueRead: response?.value ?? request.value,

    operation: request.operation,

    requestPacket: request,
    responsePacket: response,

    completed: response !== null,

    suspicious:
      request.severity === "HIGH" ||
      request.severity === "CRITICAL",

    physicalMeaning: request.physicalMeaning,
  };
}

export function getCompletedSessions(packetList = []) {
  return reconstructSessions(packetList).filter(
    (session) => session.completed
  );
}

export function getIncompleteSessions(packetList = []) {
  return reconstructSessions(packetList).filter(
    (session) => !session.completed
  );
}

export function getWriteSessions(packetList = []) {
  return reconstructSessions(packetList).filter(
    (session) =>
      session.functionCode === 5 ||
      session.functionCode === 6 ||
      session.functionCode === 15 ||
      session.functionCode === 16
  );
}

export function getReadSessions(packetList = []) {
  return reconstructSessions(packetList).filter(
    (session) =>
      session.functionCode === 1 ||
      session.functionCode === 2 ||
      session.functionCode === 3 ||
      session.functionCode === 4
  );
}

export function getSuspiciousSessions(packetList = []) {
  return reconstructSessions(packetList).filter(
    (session) => session.suspicious
  );
}

export function summarizeSession(session) {
  if (!session) return null;

  return {
    id: session.sessionId,

    source: session.source,

    destination: session.destination,

    operation: session.operation,

    function: session.functionName,

    register: session.registerLabel,

    completed: session.completed,

    suspicious: session.suspicious,

    meaning: session.physicalMeaning,
  };
}
