import { enrichDeviceFields } from "./network/deviceDirectory";
import { PLC_REGISTERS } from "./plc/plcEngine";

let attackTransactionId = 30000;

const CLIENT_PORTS = {
  HMI01: 51020,
  Historian01: 51030,
  EWS01: 51050,
  SCADA01: 51040,
  NMS01: 51070,
  UNKNOWN: 51250,
  "192.168.1.250": 51250,
};

const SPOOF_REGISTER_VALUES = {
  tankLevel: { register: PLC_REGISTERS.TANK_LEVEL, displayedValue: 35 },
  flowRate: { register: PLC_REGISTERS.FLOW_RATE, displayedValue: 25 },
  temperature: { register: PLC_REGISTERS.TEMPERATURE, displayedValue: 70 },
  chemicalLevel: { register: PLC_REGISTERS.CHEMICAL_LEVEL, displayedValue: 108 },
};


function packetTime(offsetMs = 0) {
  const epochMs = Date.now() + offsetMs;
  return {
    timestamp: new Date(epochMs).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    }),
    timestampEpochMs: epochMs,
  };
}
function nextAttackTransactionId() {
  attackTransactionId += 1;
  return attackTransactionId;
}

function normalizeSource(source) {
  if (source === "192.168.1.250") return "UNKNOWN";
  return source || "UNKNOWN";
}

function clientPort(source) {
  return CLIENT_PORTS[source] || CLIENT_PORTS[normalizeSource(source)] || 51000;
}

function withDeviceFields(fields) {
  return enrichDeviceFields(createPacketRecord(fields));
}

export function createPacketRecord({
  timestamp = new Date().toLocaleTimeString(),
  source,
  destination,
  protocol,
  port,
  operation,
  payload = {},
  severity = "INFO",
  ...extraFields
}) {
  return {
    timestamp,
    source,
    destination,
    protocol,
    port,
    operation,
    payload,
    severity,
    ...extraFields,
  };
}

export function createPcapSession(name = "Untitled Capture") {
  return {
    id: `pcap-${Date.now()}`,
    name,
    startedAt: new Date().toLocaleTimeString(),
    stoppedAt: null,
    status: "RECORDING",
    packets: [],
  };
}

export function addPacketsToSession(session, packets = []) {
  return {
    ...session,
    packets: [...session.packets, ...packets],
  };
}

export function stopPcapSession(session) {
  return {
    ...session,
    stoppedAt: new Date().toLocaleTimeString(),
    status: "STOPPED",
  };
}

export function createModbusRequest({
  timestamp = new Date().toLocaleTimeString(),
  source = "HMI01",
  destination = "PLC01",
  functionCode = 3,
  operation,
  register = PLC_REGISTERS.TANK_LEVEL,
  quantity = 1,
  value = "poll",
  transactionId = nextAttackTransactionId(),
  severity = "INFO",
  payload = {},
}) {
  const normalizedSource = normalizeSource(source);

  return withDeviceFields({
    timestamp,
    transactionId,
    source: normalizedSource,
    destination,
    protocol: "Modbus TCP",
    port: 502,
    clientPort: clientPort(normalizedSource),
    functionCode,
    operation:
      operation ||
      (functionCode === 3
        ? "Read Holding Registers"
        : functionCode === 16
          ? "Write Multiple Registers"
          : "Write Single Register"),
    register,
    quantity,
    value,
    payload,
    severity,
  });
}

export function createModbusResponse({
  timestamp = new Date().toLocaleTimeString(),
  source = "PLC01",
  destination = "HMI01",
  functionCode = 3,
  operation,
  register = PLC_REGISTERS.TANK_LEVEL,
  quantity = 1,
  value = 0,
  transactionId,
  severity = "INFO",
  payload = {},
}) {
  const normalizedDestination = normalizeSource(destination);

  return withDeviceFields({
    timestamp,
    transactionId: transactionId || nextAttackTransactionId(),
    source,
    destination: normalizedDestination,
    protocol: "Modbus TCP",
    port: 502,
    clientPort: clientPort(normalizedDestination),
    functionCode,
    operation:
      operation ||
      (functionCode === 3
        ? "Read Response"
        : functionCode === 16
          ? "Write Multiple Registers Response"
          : "Write Single Register Response"),
    register,
    quantity,
    value,
    payload,
    severity,
  });
}

export function createModbusWritePair({
  timestamp,
  source = "EWS01",
  destination = "PLC01",
  register,
  value,
  functionCode = 6,
  operation,
  writes,
  severity = "HIGH",
  transactionId = nextAttackTransactionId(),
  responseDelayMs = 14,
  requestOffsetMs = 0,
}) {
  const requestTime = timestamp ? { timestamp } : packetTime(requestOffsetMs);
  const responseTime = packetTime(requestOffsetMs + responseDelayMs);

  const request = createModbusRequest({
    ...requestTime,
    source,
    destination,
    functionCode,
    operation,
    register,
    quantity: writes?.length || 1,
    value: writes || value,
    transactionId,
    severity,
    payload: writes ? { writes } : { register, value },
  });

  const response = createModbusResponse({
    ...responseTime,
    source: destination,
    destination: source,
    functionCode,
    operation:
      functionCode === 16
        ? "Write Multiple Registers Response"
        : "Write Single Register Response",
    register,
    quantity: writes?.length || 1,
    value: writes || value,
    transactionId,
    severity,
    payload: writes ? { writes } : { register, value },
  });

  return [request, response];
}

function createReadPair({ source, destination = "PLC01", register, quantity = 1, value, severity = "LOW" }) {
  const timestamp = new Date().toLocaleTimeString();
  const transactionId = nextAttackTransactionId();

  return [
    createModbusRequest({
      timestamp,
      source,
      destination,
      functionCode: 3,
      operation: "Read Holding Registers",
      register,
      quantity,
      value: "scan",
      transactionId,
      severity,
    }),
    createModbusResponse({
      timestamp,
      source: destination,
      destination: source,
      functionCode: 3,
      operation: "Read Response",
      register,
      quantity,
      value: value ?? Array.from({ length: quantity }, () => 0),
      transactionId,
      severity,
    }),
  ];
}

function createSpoofPackets(attack, state) {
  const timestamp = new Date().toLocaleTimeString();
  const packets = [];
  const spoof = attack.spoof || {};
  const displayedValues = spoof.displayedValues || {
    [spoof.variable]: spoof.displayedValue,
  };

  Object.entries(displayedValues).forEach(([variable, displayedValue]) => {
    const map = SPOOF_REGISTER_VALUES[variable];
    if (!map) return;

    const transactionId = nextAttackTransactionId();
    const realValue = state?.[variable] ?? state?.plc?.registers?.[map.register] ?? 0;

    packets.push(
      createModbusRequest({
        timestamp,
        source: "HMI01",
        destination: "PLC01",
        functionCode: 3,
        operation: "Read Holding Registers",
        register: map.register,
        quantity: 1,
        value: "poll",
        transactionId,
        severity: "INFO",
      })
    );

    packets.push(
      createModbusResponse({
        timestamp,
        source: "PLC01",
        destination: "HMI01",
        functionCode: 3,
        operation: "Read Holding Registers Response",
        register: map.register,
        quantity: 1,
        value: Math.round(Number(realValue) * 10),
        transactionId,
        severity: attack.severity || "HIGH",
        payload: {
          attackId: attack.id,
          tag: spoof.tag || variable,
          variable,
          actualValue: Number(realValue),
          displayedValue: Number(displayedValue),
          note: "PLC response remains authentic; the HMI application displays a different value.",
        },
      })
    );
  });

  packets.push(
    withDeviceFields({
      timestamp,
      source: "UNKNOWN",
      destination: "HMI01",
      protocol: "HMI Application Event",
      port: 443,
      operation: "Displayed Value Override",
      payload: spoof,
      severity: attack.severity || "HIGH",
    })
  );

  return packets;
}

function createNetworkAttackPackets(attack, state) {
  switch (attack.id) {
    case "IP_SPOOFING": {
      const packets = createReadPair({
        source: "EWS01",
        register: PLC_REGISTERS.TANK_LEVEL,
        quantity: 1,
        severity: "HIGH",
      });

      return packets.map((packet) => ({
        ...packet,
        payload: {
          ...(packet.payload || {}),
          attackId: attack.id,
          actualSource: "UNKNOWN",
          actualSourceIp: "192.168.1.250",
          spoofedSource: "EWS01",
          spoofedSourceIp: "192.168.1.50",
          identityMismatch: true,
        },
      }));
    }

    case "MODBUS_SCAN": {
      const registers = [40001, 40002, 40003, 40004, 40010, 40020, 40030, 40040];
      return registers.flatMap((register) =>
        createReadPair({ source: "UNKNOWN", register, quantity: 1, severity: "LOW" })
      );
    }

    case "PACKET_INJECTION": {
      return createModbusWritePair({
        source: "UNKNOWN",
        destination: "PLC01",
        functionCode: 6,
        operation: "Forged Write Single Register",
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 0,
        severity: "HIGH",
      });
    }

    case "REPLAY_ATTACK": {
      const transactionId = nextAttackTransactionId();
      const first = createModbusWritePair({
        source: "UNKNOWN",
        destination: "PLC01",
        functionCode: 6,
        operation: "Captured Write Single Register",
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 0,
        severity: "HIGH",
        transactionId,
        requestOffsetMs: 0,
      });
      const replayed = createModbusWritePair({
        source: "UNKNOWN",
        destination: "PLC01",
        functionCode: 6,
        operation: "Replayed Write Single Register",
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 0,
        severity: "HIGH",
        transactionId,
        requestOffsetMs: 750,
      });
      return [...first, ...replayed];
    }

    case "PLC_DOS": {
      return Array.from({ length: 35 }, (_, index) =>
        createModbusRequest({
          source: index % 2 === 0 ? "UNKNOWN" : "EWS01",
          destination: "PLC01",
          functionCode: 3,
          operation: "Flood Read Holding Registers",
          register: 40001 + (index % 4),
          quantity: 4,
          value: "flood",
          severity: "CRITICAL",
        })
      );
    }

    case "PACKET_LOSS": {
      return [
        withDeviceFields({
          timestamp: new Date().toLocaleTimeString(),
          source: "HMI01",
          destination: "PLC01",
          protocol: "Modbus TCP",
          port: 502,
          clientPort: clientPort("HMI01"),
          functionCode: 3,
          operation: "Read Holding Registers Timeout",
          register: "40001-40004",
          quantity: 4,
          value: "timeout / dropped response",
          severity: "MEDIUM",
          payload: { packetLoss: attack.network?.packetLoss ?? 40 },
        }),
      ];
    }

    default:
      return [];
  }
}

export function generateAttackPackets(attack, state = {}) {
  if (!attack) return [];

  if (attack.spoof) {
    return createSpoofPackets(attack, state);
  }

  if (["IP_SPOOFING", "MODBUS_SCAN", "PACKET_INJECTION", "REPLAY_ATTACK", "PLC_DOS", "PACKET_LOSS"].includes(attack.id)) {
    return createNetworkAttackPackets(attack, state);
  }

  if (attack.plcWrites?.length) {
    return createModbusWritePair({
      source: attack.pcap?.source || "EWS01",
      destination: attack.pcap?.destination || "PLC01",
      functionCode: attack.pcap?.functionCode || 16,
      operation: attack.pcap?.operation || "Write Multiple Registers",
      register: attack.plcWrites[0].register,
      writes: attack.plcWrites,
      severity: attack.severity || "HIGH",
    });
  }

  if (attack.plcWrite) {
    return createModbusWritePair({
      source: attack.pcap?.source || "EWS01",
      destination: attack.pcap?.destination || "PLC01",
      functionCode: attack.pcap?.functionCode || 6,
      operation: attack.pcap?.operation || "Write Single Register",
      register: attack.plcWrite.register,
      value: attack.plcWrite.value,
      severity: attack.severity || "HIGH",
    });
  }

  return [];
}
