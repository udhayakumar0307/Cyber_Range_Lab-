export function createInitialNetwork() {
  return [
    {
      id: "FW01",
      name: "Firewall",
      type: "Security",
      status: "ONLINE",
      protocol: "TCP/IP",
    },
    {
      id: "EWS01",
      name: "Engineering WS",
      type: "Workstation",
      status: "ONLINE",
      protocol: "HTTP / SSH",
    },
    {
      id: "HMI01",
      name: "HMI",
      type: "Operator Station",
      status: "ONLINE",
      protocol: "HTTP",
    },
    {
      id: "PLC01",
      name: "PLC",
      type: "Controller",
      status: "ONLINE",
      protocol: "Modbus TCP",
    },
    {
      id: "RIO01",
      name: "Remote I/O",
      type: "Field Device",
      status: "ONLINE",
      protocol: "Modbus TCP",
    },
  ];
}

export function updateNetworkForAttack(network = [], attackType) {
  return network.map((device) => {
    if (attackType === "PLC_DOS" && device.id === "PLC01") {
      return { ...device, status: "DEGRADED" };
    }

    if (
      ["CLOSE_VALVE", "STOP_PUMP", "HEATER_RUNAWAY", "CHEMICAL_OVERDOSE"].includes(
        attackType
      ) &&
      device.id === "EWS01"
    ) {
      return { ...device, status: "SUSPICIOUS" };
    }

    return device;
  });
}
