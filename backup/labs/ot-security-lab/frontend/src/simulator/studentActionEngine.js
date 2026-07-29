export function applyStudentAction(state, actionType) {
  const event = {
    time: new Date().toLocaleTimeString(),
    source: "Student Response",
    severity: "INFO",
    message: "",
  };

  let next = { ...state };

  switch (actionType) {
    case "START_PUMP":
      next.pumpCommand = "RUNNING";
      event.message = "Student issued pump start command";
      break;

    case "OPEN_VALVE":
      next.valvePositionTarget = 50;
      event.message = "Student restored valve position to 50%";
      break;

    case "RESET_HEATER":
      next.heaterCommand = "ON";
      next.temperatureTarget = 68;
      event.message = "Student reset heater setpoint";
      break;

    case "RESET_CHEMICAL":
      next.chemicalTarget = 108;
      event.message = "Student normalized chemical dosing";
      break;

    case "ISOLATE_EWS":
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "EWS01"
          ? { ...device, status: "ISOLATED" }
          : device
      );
      next.ewsState = "ISOLATED";
      event.message = "Student isolated Engineering Workstation";
      break;

    case "RECONNECT_EWS":
    case "RESTORE_EWS":
      next.networkDevices = (next.networkDevices || []).map((device) =>
        device.id === "EWS01"
          ? { ...device, status: "ONLINE" }
          : device
      );
      next.ewsState = "ONLINE";
      event.message = "Student restored Engineering Workstation connectivity";
      break;

    case "RESTORE_NETWORK":
      next.networkDevices = (next.networkDevices || []).map((device) => ({
        ...device,
        status: "ONLINE",
      }));
      next.ewsState = "ONLINE";
      event.message = "Student restored network connectivity";
      break;

    default:
      event.message = `Unknown student action: ${actionType}`;
      break;
  }

  return {
    ...next,
    exerciseState:
      state.exerciseState === "INCIDENT" ? "RECOVERY" : state.exerciseState,
    events: [event, ...(state.events || [])].slice(0, 20),
  };
}
