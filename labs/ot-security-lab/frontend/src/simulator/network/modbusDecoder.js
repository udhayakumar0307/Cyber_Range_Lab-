import {
  getRegisterInfo,
  getRegisterLabel,
  getRegisterPhysicalMeaning,
} from "./registerMapper";

export function decodeModbusPacket(packet = {}) {
  const functionCode = getFunctionCode(packet);
  const register = getRegister(packet);
  const value = getValue(packet);
  const registerInfo = register ? getRegisterInfo(register) : null;

  return {
    original: packet,

    timestamp: packet.timestamp || "-",
    source: packet.source || "UNKNOWN",
    destination: packet.destination || "UNKNOWN",
    protocol: packet.protocol || "UNKNOWN",

    isModbus: packet.protocol === "Modbus TCP",
    functionCode,
    functionName: getFunctionName(functionCode),
    operation: packet.operation || getFunctionName(functionCode),

    register,
    registerLabel: register ? getRegisterLabel(register) : "-",
    registerInfo,

    value,

    severity: packet.severity || "INFO",

    physicalMeaning:
      register && value !== undefined
        ? getRegisterPhysicalMeaning(register, value)
        : "No process mapping available.",

    isWrite: functionCode === 5 || functionCode === 6 || functionCode === 15 || functionCode === 16,
    isRead: functionCode === 1 || functionCode === 2 || functionCode === 3 || functionCode === 4,
  };
}

export function decodePackets(packets = []) {
  return packets.map((packet, index) => ({
    index,
    ...decodeModbusPacket(packet),
  }));
}

function getFunctionCode(packet) {
  if (packet.functionCode !== undefined) return Number(packet.functionCode);

  const op = (packet.operation || "").toLowerCase();

  if (op.includes("read holding")) return 3;
  if (op.includes("write single register")) return 6;
  if (op.includes("write multiple")) return 16;
  if (op.includes("read response")) return 3;

  return null;
}

function getRegister(packet) {
  const raw = packet.register ?? packet.payload?.register;

  if (raw === undefined || raw === null) return null;

  if (typeof raw === "string" && raw.includes("-")) {
    return raw;
  }

  const numeric = Number(raw);
  return Number.isNaN(numeric) ? raw : numeric;
}

function getValue(packet) {
  if (packet.value !== undefined) return packet.value;
  if (packet.payload?.value !== undefined) return packet.payload.value;
  return undefined;
}

export function getFunctionName(functionCode) {
  switch (Number(functionCode)) {
    case 1:
      return "Read Coils";
    case 2:
      return "Read Discrete Inputs";
    case 3:
      return "Read Holding Registers";
    case 4:
      return "Read Input Registers";
    case 5:
      return "Write Single Coil";
    case 6:
      return "Write Single Register";
    case 15:
      return "Write Multiple Coils";
    case 16:
      return "Write Multiple Registers";
    default:
      return "Unknown Function";
  }
}

export function isSuspiciousModbusWrite(decodedPacket) {
  if (!decodedPacket?.isWrite) return false;

  const normalWriters = ["HMI01"];
  return !normalWriters.includes(decodedPacket.source);
}
