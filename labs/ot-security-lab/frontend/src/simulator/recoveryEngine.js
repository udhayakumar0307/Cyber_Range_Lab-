import { modbusWriteSingleRegister } from "./plc/modbusEngine";
import { PLC_REGISTERS, applyPLCToPlant } from "./plc/plcEngine";
import { recoveryActionToPLCWrite } from "./plc/plcCommandMapper";
import { createPacketRecord, createModbusWritePair } from "./pcapEngine";
import { containAttacksByAction } from "./attackScheduler";
import { validateResponseAction, advanceResponseWorkflow } from "./responseWorkflow";

function controlPacket(time, actionType, message, destination = "FW01") {
  return createPacketRecord({
    timestamp: time,
    source: "HMI01",
    destination,
    protocol: "System Recovery",
    port: 443,
    operation: actionType,
    payload: { action: actionType, message },
    severity: "INFO",
  });
}

function writeRecoveryRegister(next, register, value, packets, source = "HMI01") {
  const result = modbusWriteSingleRegister(next.plc, register, value, source);
  packets.push(
    ...createModbusWritePair({
      source,
      destination: "PLC01",
      register,
      value,
      functionCode: 6,
      operation: "Authorized Recovery Write",
      severity: "INFO",
    })
  );
  return applyPLCToPlant({ ...next, plc: result.plc });
}

export function applyRecoveryAction(state, actionType) {
  const time = new Date().toLocaleTimeString();
  const validation = validateResponseAction(state, actionType);

  if (!validation.allowed) {
    return {
      ...state,
      events: [
        {
          time,
          source: "Response Console",
          severity: "WARNING",
          message: validation.reason,
        },
        ...(state.events || []),
      ].slice(0, 20),
      responseFeedback: {
        ok: false,
        time,
        message: validation.reason,
      },
    };
  }

  const event = {
    time,
    source: "Student Response",
    severity: "INFO",
    message: "",
  };

  let next = { ...state };
  let packets = [];

  switch (actionType) {

    case "IDENTIFY_EWS_SOURCE":
      event.message = "Student confirmed the Engineering Workstation as the source of the malicious command";
      packets.push(controlPacket(time, actionType, event.message, "EWS01"));
      break;

    case "REVIEW_TRAFFIC_PATTERN":
      event.message = "Student reviewed protocol timing, function codes, and repeated traffic patterns";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "REVIEW_ASSET_INVENTORY":
      event.message = "Student reviewed the trusted OT asset and address inventory";
      packets.push(controlPacket(time, actionType, event.message, "FW01"));
      break;

    case "COMPARE_HMI_PLC":
      event.message = "Student compared HMI values with PLC registers and historian records";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "ISOLATE_HMI_DATA_PATH":
      next.hmiDataPathState = "ISOLATED";
      event.message = "Student isolated the compromised HMI data path while preserving PLC operation";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "START_TRUSTED_REFRESH":
      next.hmiRefreshPending = true;
      event.message = "Student requested a fresh trusted PLC-to-HMI polling cycle";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "START_CLEAN_TRAFFIC_WINDOW":
      event.message = "Student started a clean-traffic observation window";
      packets.push(controlPacket(time, actionType, event.message, "FW01"));
      break;

    case "START_STABILITY_WINDOW":
      event.message = "Student started a process-stability observation window";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "WAIT_FOR_CLEAN_TRAFFIC":
      event.message = "Clean-traffic observation window completed";
      packets.push(controlPacket(time, actionType, event.message, "FW01"));
      break;

    case "WAIT_FOR_PROCESS_STABILITY":
      event.message = "Process-stability observation window completed";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "VERIFY_HMI_MATCH":
      event.message = "Student verified that HMI, PLC, and historian values match";
      next.hmiDataPathState = "ONLINE";
      next.hmiRefreshPending = false;
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;
    case "RESTORE_SENSOR_DATA":
      next.spoofing = null;
      event.message = "Student restored sensor data integrity";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "RESTORE_HMI_DATA":
      next.spoofing = null;
      next.hmiDataPathState = "ONLINE";
      next.hmiRefreshPending = false;
      event.message = "Student restored HMI display data from the fresh trusted PLC poll";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "RESTART_PLC":
      next.networkState = null;
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "PLC01" ? { ...device, status: "ONLINE" } : device
      );
      event.message = "Student restarted PLC communications";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "BLOCK_SOURCE":
    case "REMOVE_FORGED_DEVICE":
      next.networkState = null;
      event.message = "Student blocked suspicious or forged network source";
      packets.push(controlPacket(time, actionType, event.message, "FW01"));
      break;

    case "ISOLATE_EWS":
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "EWS01" ? { ...device, status: "ISOLATED" } : device
      );
      next.ewsState = "ISOLATED";
      next.networkState = null;
      event.message = "Student isolated Engineering Workstation";
      packets.push(controlPacket(time, actionType, event.message, "SW01"));
      break;

    case "RECONNECT_EWS":
    case "RESTORE_EWS":
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "EWS01" ? { ...device, status: "ONLINE" } : device
      );
      next.ewsState = "ONLINE";
      event.message = "Student restored Engineering Workstation connectivity";
      packets.push(controlPacket(time, actionType, event.message, "SW01"));
      break;

    case "ISOLATE_NETWORK":
      next.networkState = null;
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "PLC01" ? { ...device, status: "ISOLATED" } : device
      );
      event.message = "Student isolated affected PLC network segment";
      packets.push(controlPacket(time, actionType, event.message, "SW01"));
      break;

    case "CHECK_NETWORK":
      event.message = "Student inspected packet loss, latency, and device communication status";
      packets.push(controlPacket(time, actionType, event.message, "SW01"));
      break;

    case "RESTORE_NETWORK":
      next.networkState = null;
      next.networkDevices = (next.networkDevices || []).map((device) => ({
        ...device,
        status: "ONLINE",
      }));
      next.ewsState = "ONLINE";
      event.message = "Student restored network connectivity";
      packets.push(controlPacket(time, actionType, event.message, "SW01"));
      break;

    case "VERIFY_REGISTER_VALUES":
    case "VERIFY_CURRENT_STATE":
      event.message = "Student verified PLC register values and current process state";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "VERIFY_SOURCE_IDENTITY":
      event.message = "Student validated the observed source against the trusted device inventory";
      packets.push(controlPacket(time, actionType, event.message, "FW01"));
      break;

    case "WAIT_FOR_TRUSTED_UPDATE":
      event.message = "Student waited for a fresh trusted PLC-to-HMI update cycle";
      packets.push(controlPacket(time, actionType, event.message, "HMI01"));
      break;

    case "VERIFY_RECOVERY":
      event.message = "Student verified process values, alarms, and communication state";
      packets.push(controlPacket(time, actionType, event.message, "PLC01"));
      break;

    case "RESTORE_PROCESS":
      next = writeRecoveryRegister(next, PLC_REGISTERS.PUMP_COMMAND, 1, packets);
      next = writeRecoveryRegister(next, PLC_REGISTERS.VALVE_POSITION, 50, packets);
      next = writeRecoveryRegister(next, PLC_REGISTERS.HEATER_COMMAND, 1, packets);
      next = writeRecoveryRegister(next, PLC_REGISTERS.CHEMICAL_TARGET, 108, packets);
      event.message = "Student restored normal PLC process state";
      break;

    default: {
      const write = recoveryActionToPLCWrite(actionType);

      if (!write) {
        return {
          ...state,
          events: [
            {
              ...event,
              message: `Unknown recovery action: ${actionType}`,
            },
            ...(state.events || []),
          ].slice(0, 20),
        };
      }

      next = writeRecoveryRegister(next, write.register, write.value, packets);
      if (actionType === "RESET_HEATER") {
        next = { ...next, temperatureTarget: 70.5 };
      }
      event.message = `Student action executed: ${write.description}`;
      break;
    }
  }

  next = containAttacksByAction(next, actionType);
  next = advanceResponseWorkflow(next, actionType);

  const incidentComplete = (next.activeAttacks || []).some(
    (attack) => attack.completed && attack.completedAt === time
  );

  return {
    ...next,
    exerciseState: incidentComplete
      ? "COMPLETE"
      : state.exerciseState === "INCIDENT"
        ? "RECOVERY"
        : state.exerciseState,
    events: [event, ...(state.events || [])].slice(0, 20),
    pcapPackets: [...(state.pcapPackets || []), ...packets],
    responseFeedback: {
      ok: true,
      time,
      message: event.message,
    },
  };
}
