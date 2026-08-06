import { plcReadRegister, plcWriteRegister } from "./plcEngine";

export function modbusReadHoldingRegister(plc, register, source = "HMI01") {
  const response = plcReadRegister(plc, register);

  return {
    plc,
    packet: {
      timestamp: new Date().toLocaleTimeString(),
      source,
      destination: plc.id,
      protocol: "Modbus TCP",
      port: 502,
      functionCode: 3,
      operation: "Read Holding Register",
      register,
      value: response.value,
      severity: "INFO",
    },
  };
}

export function modbusWriteSingleRegister(
  plc,
  register,
  value,
  source = "HMI01"
) {
  const updatedPLC = plcWriteRegister(plc, register, value, source);

  return {
    plc: updatedPLC,
    packet: {
      timestamp: new Date().toLocaleTimeString(),
      source,
      destination: plc.id,
      protocol: "Modbus TCP",
      port: 502,
      functionCode: 6,
      operation: "Write Single Register",
      register,
      value,
      severity: source === "EWS01" ? "HIGH" : "INFO",
    },
  };
}

export function modbusWriteMultipleRegisters(
  plc,
  writes = [],
  source = "HMI01"
) {
  let updatedPLC = plc;
  const packets = [];

  writes.forEach(({ register, value }) => {
    const result = modbusWriteSingleRegister(
      updatedPLC,
      register,
      value,
      source
    );

    updatedPLC = result.plc;
    packets.push(result.packet);
  });

  return {
    plc: updatedPLC,
    packets,
  };
}
