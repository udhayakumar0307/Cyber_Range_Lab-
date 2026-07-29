import { applyAttack } from "./attackEngine";
import { updateNetworkForAttack } from "./networkEngine";
import { addActiveAttack, isAttackSourceBlocked } from "./attackScheduler";

export function runScenario(state, scenarioType) {
  if (scenarioType === "RESET") {
    return {
      ...state,

      plantStatus: "RUNNING",
      communications: "HEALTHY",
      plcStatus: "CONNECTED",

      tankLevel: 70.5,
      flowRate: 25,
      temperature: 70.5,
      chemicalLevel: 108,

      pumpStatus: "RUNNING",
      pumpCommand: "RUNNING",

      valvePosition: 50,
      valvePositionTarget: 50,

      heaterStatus: "ON",
      heaterCommand: "ON",
      temperatureTarget: 70.5,

      chemicalTarget: 108,

      activeScenario: "Normal Operation",
      exerciseState: "NORMAL",

      activeAlarms: 0,
      alarms: [],

      pcapPackets: [],
      ewsState: "ONLINE",
      activeAttacks: [],
    };
  }

  if (isAttackSourceBlocked(state, scenarioType)) {
    return addActiveAttack(state, scenarioType);
  }

  const attackedState = applyAttack(state, scenarioType);
  const scheduledState = addActiveAttack(attackedState, scenarioType);
  const updatedNetwork = updateNetworkForAttack(
    scheduledState.networkDevices || [],
    scenarioType
  );

  return {
    ...scheduledState,
    activeScenario: scenarioType,
    exerciseState: "INCIDENT",
    networkDevices: updatedNetwork,
  };
}
