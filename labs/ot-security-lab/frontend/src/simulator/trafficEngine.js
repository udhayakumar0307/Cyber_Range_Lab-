import { createPacketRecord } from "./pcapEngine";
import { enrichDeviceFields } from "./network/deviceDirectory";
import { getRegisterSnapshot } from "./plc/registerStore";

let tick = 0;
let transactionId = 1000;
let dnp3Sequence = 0;

const CLIENT_PORTS = {
  HMI01: 51020,
  Historian01: 51030,
  EWS01: 51050,
  SCADA01: 51040,
};

function nextTransactionId() {
  transactionId = (transactionId + 1) & 0xffff;
  if (transactionId === 0) transactionId = 1;
  return transactionId;
}

function now(offsetMs = 0) {
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

function packet(fields) {
  return enrichDeviceFields(createPacketRecord(fields));
}

function clientPort(device) {
  return CLIENT_PORTS[device] || 51000;
}

function scaleRegisterValue(value) {
  return Math.max(0, Math.min(65535, Math.round(Number(value || 0) * 10)));
}

function modbusReadPair({ source, register, quantity, values, responseDelayMs = 12, severity = "INFO" }) {
  const tid = nextTransactionId();
  const port = clientPort(source);
  const requestTime = now(0);
  const responseTime = now(responseDelayMs);

  return [
    packet({
      ...requestTime,
      transactionId: tid,
      source,
      destination: "PLC01",
      protocol: "Modbus TCP",
      transport: "TCP",
      port: 502,
      clientPort: port,
      unitId: 1,
      functionCode: 3,
      operation: "Read Holding Registers Request",
      register,
      quantity,
      value: "request",
      latencyMs: 0,
      severity,
    }),
    packet({
      ...responseTime,
      transactionId: tid,
      source: "PLC01",
      destination: source,
      protocol: "Modbus TCP",
      transport: "TCP",
      port: 502,
      clientPort: port,
      unitId: 1,
      functionCode: 3,
      operation: "Read Holding Registers Response",
      register,
      quantity,
      value: values,
      latencyMs: responseDelayMs,
      severity,
    }),
  ];
}

function dnp3ReadPair(process) {
  dnp3Sequence = (dnp3Sequence + 1) & 0x0f;
  const requestTime = now(0);
  const responseTime = now(28);

  return [
    packet({
      ...requestTime,
      source: "SCADA01",
      destination: "RTU01",
      protocol: "DNP3",
      transport: "TCP",
      port: 20000,
      clientPort: 52040,
      operation: "Class 0 Read Request",
      dnp3FunctionCode: 1,
      dnp3Sequence,
      value: "static data poll",
      severity: "INFO",
    }),
    packet({
      ...responseTime,
      source: "RTU01",
      destination: "SCADA01",
      protocol: "DNP3",
      transport: "TCP",
      port: 20000,
      clientPort: 52040,
      operation: "Class 0 Read Response",
      dnp3FunctionCode: 129,
      dnp3Sequence,
      value: {
        remoteTankLevel: Number(process.tankLevel.toFixed(1)),
        remoteFlowRate: Number(process.flowRate.toFixed(1)),
      },
      latencyMs: 28,
      severity: "INFO",
    }),
  ];
}

export function generateNormalTraffic(state) {
  const process = getRegisterSnapshot(state);
  const packets = [];
  tick += 1;

  const degraded =
    state.networkState?.attackId === "PLC_DOS" ||
    state.networkState?.communication === "DEGRADED";

  const hmiDelay = degraded ? 850 : 12;
  const hmiValues = [
    scaleRegisterValue(process.tankLevel),
    scaleRegisterValue(process.flowRate),
    scaleRegisterValue(process.temperature),
    scaleRegisterValue(process.chemicalLevel),
  ];

  // HMI polls the four contiguous measurement registers every scan cycle.
  const hmiPair = modbusReadPair({
    source: "HMI01",
    register: 40001,
    quantity: 4,
    values: hmiValues,
    responseDelayMs: hmiDelay,
    severity: degraded ? "MEDIUM" : "INFO",
  });

  packets.push(hmiPair[0]);
  if (!degraded || tick % 3 === 0) packets.push(hmiPair[1]);

  // Historian performs a slower independent Modbus poll.
  if (tick % 3 === 0) {
    packets.push(
      ...modbusReadPair({
        source: "Historian01",
        register: 40001,
        quantity: 4,
        values: hmiValues,
        responseDelayMs: degraded ? 900 : 18,
        severity: degraded ? "MEDIUM" : "INFO",
      })
    );
  }

  // DNP3 is retained as the second supported OT protocol.
  if (tick % 5 === 0) packets.push(...dnp3ReadPair(process));

  return packets;
}
