const registerMap = {
  40001: { tag: "LT101", name: "Tank Level", asset: "Tank", unit: "%" },
  40002: { tag: "FT101", name: "Flow Rate", asset: "Flow Transmitter", unit: "L/min" },
  40003: { tag: "TT101", name: "Temperature", asset: "Heater", unit: "°C" },
  40004: { tag: "AT101", name: "Chemical Level", asset: "Chemical Analyzer", unit: "ppm" },

  40010: { tag: "XV101", name: "Valve Position", asset: "Control Valve", unit: "%" },
  40020: { tag: "P101", name: "Pump Command", asset: "Transfer Pump", unit: "" },
  40030: { tag: "H101", name: "Heater Command", asset: "Heater", unit: "" },
  40040: { tag: "DP101", name: "Chemical Target", asset: "Chemical Dosing", unit: "ppm" },
};

export function analyzePackets(packets = []) {
  const protocols = {};
  let writeCount = 0;
  let readCount = 0;
  let suspiciousCount = 0;
  const affectedRegisters = {};

  packets.forEach((packet) => {
    protocols[packet.protocol] = (protocols[packet.protocol] || 0) + 1;

    const operation = packet.operation || "";

    if (operation.toLowerCase().includes("write")) writeCount++;
    if (operation.toLowerCase().includes("read")) readCount++;

    if (packet.severity === "HIGH" || packet.severity === "CRITICAL") {
      suspiciousCount++;
    }

    const register = Number(packet.register || packet.payload?.register);

    if (register) {
      affectedRegisters[register] = (affectedRegisters[register] || 0) + 1;
    }
  });

  return {
    totalPackets: packets.length,
    protocols,
    writeCount,
    readCount,
    suspiciousCount,
    affectedRegisters,
  };
}

export function decodePacket(packet) {
  if (!packet) return null;

  const register = Number(packet.register || packet.payload?.register);
  const value = packet.value ?? packet.payload?.value;
  const registerInfo = registerMap[register];

  return {
    ...packet,
    decoded: {
      register,
      value,
      functionCode: packet.functionCode || inferFunctionCode(packet.operation),
      tag: registerInfo?.tag || "Unknown",
      name: registerInfo?.name || "Unknown Register",
      asset: registerInfo?.asset || "Unknown Asset",
      unit: registerInfo?.unit || "",
      meaning: buildMeaning(packet, registerInfo, value),
      consequence: buildConsequence(register, value),
    },
  };
}

export function getRegisterInfo(register) {
  return registerMap[Number(register)];
}

function inferFunctionCode(operation = "") {
  const op = operation.toLowerCase();

  if (op.includes("write single register")) return 6;
  if (op.includes("write multiple")) return 16;
  if (op.includes("read holding")) return 3;

  return "-";
}

function buildMeaning(packet, registerInfo, value) {
  if (!registerInfo) {
    return "This packet references a register that is not currently mapped.";
  }

  if ((packet.operation || "").toLowerCase().includes("write")) {
    return `${packet.source} wrote value ${value} to ${registerInfo.tag} (${registerInfo.name}), affecting ${registerInfo.asset}.`;
  }

  if ((packet.operation || "").toLowerCase().includes("read")) {
    return `${packet.source} read ${registerInfo.tag} (${registerInfo.name}) from ${registerInfo.asset}.`;
  }

  return `This packet is related to ${registerInfo.tag} (${registerInfo.name}).`;
}

function buildConsequence(register, value) {
  switch (Number(register)) {
    case 40010:
      return value === 0
        ? "Valve XV101 is commanded closed. Expected effect: flow decreases and tank level may rise."
        : "Valve XV101 position is changed. Expected effect: process flow changes.";

    case 40020:
      return value === 0
        ? "Pump P101 is commanded to stop. Expected effect: flow drops and tank level may rise."
        : "Pump P101 is commanded to run. Expected effect: flow should recover.";

    case 40030:
      return "Heater command changed. Expected effect: process temperature may change.";

    case 40040:
      return "Chemical dosing target changed. Expected effect: chemical concentration may change.";

    default:
      return "No physical consequence mapping available for this register.";
  }
}
