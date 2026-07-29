const protocolTemplates = {
  MODBUS_TCP: { protocol: "Modbus TCP", port: 502, transport: "TCP" },
  DNP3: { protocol: "DNP3", port: 20000, transport: "TCP" },
};

export function generateProtocolMessage(protocol, source, destination, operation, payload = {}) {
  const config = protocolTemplates[protocol];
  if (!config) throw new Error(`Unsupported protocol: ${protocol}`);

  const epochMs = Date.now();
  return {
    timestamp: new Date(epochMs).toLocaleTimeString(),
    timestampEpochMs: epochMs,
    protocol: config.protocol,
    transport: config.transport,
    port: config.port,
    source,
    destination,
    operation,
    payload,
  };
}

export function createNormalTraffic(state) {
  return [
    generateProtocolMessage("MODBUS_TCP", "HMI01", "PLC01", "Read Holding Registers Request", {
      functionCode: 3,
      register: 40001,
      quantity: 4,
    }),
    generateProtocolMessage("DNP3", "SCADA01", "RTU01", "Class 0 Read Request", {
      functionCode: 1,
    }),
  ];
}
