import { modbusWriteSingleRegister } from "./plc/modbusEngine";
import { applyPLCToPlant } from "./plc/plcEngine";
import { generateAttackPackets } from "./pcapEngine";
import { getAttackDefinition } from "./attacks";

export function applyAttack(state, attackType) {
  const attack = getAttackDefinition(attackType);

  if (!attack) {
    return state;
  }

  const time = new Date().toLocaleTimeString();

  const event = {
    time,
    source: "Attack Engine",
    severity: attack.severity || "HIGH",
    message: "Abnormal control activity detected",
  };

  let next = { ...state };
  let packets = [];

  if (attack.plcWrite) {
    const result = modbusWriteSingleRegister(
      state.plc,
      attack.plcWrite.register,
      attack.plcWrite.value,
      attack.pcap?.source || "EWS01"
    );

    next = applyPLCToPlant({
      ...next,
      plc: result.plc,
    });

  }

  if (attack.plcWrites) {
    attack.plcWrites.forEach((write) => {
      const result = modbusWriteSingleRegister(
        next.plc,
        write.register,
        write.value,
        attack.pcap?.source || "EWS01"
      );

      next = applyPLCToPlant({
        ...next,
        plc: result.plc,
      });

    });
  }

  if (attack.spoof) {
    next = {
      ...next,
      spoofing: {
        active: true,
        attackId: attack.id,
        ...attack.spoof,
      },
    };

  }

  if (attack.network) {
    next = {
      ...next,
      networkState: {
        active: true,
        attackId: attack.id,
        ...attack.network,
      },
      networkDevices: (next.networkDevices || []).map((device) => {
        if (
          device.id === attack.network.compromisedDevice ||
          device.id === attack.affectedAsset
        ) {
          return {
            ...device,
            status: attack.network.status || attack.network.deviceStatus || "DEGRADED",
          };
        }

        return device;
      }),
    };

  }

  if (attack.extraState) {
    next = {
      ...next,
      ...attack.extraState,
    };
  }

  packets = [...packets, ...generateAttackPackets(attack, next)];

  return {
    ...next,
    activeScenario: attack.id,
    exerciseState: "INCIDENT",
    events: [event, ...(state.events || [])].slice(0, 20),
    pcapPackets: [...(state.pcapPackets || []), ...packets],
  };
}
