import { updatePlantPhysics } from "./plantPhysics";
import { evaluateAlarms } from "./alarmEngine";
import { generateEvents } from "./eventEngine";
import { updateHistorian } from "./historianEngine";
import {
  applyPLCToPlant,
  updatePLCFromPlant,
} from "./plc/plcEngine";
import { projectRegistersToState } from "./plc/registerStore";
import { runActiveAttacks } from "./attackScheduler";
import { generateNormalTraffic } from "./trafficEngine";
import { evaluateExerciseState } from "./exerciseEngine";

export function runSimulationTick(prev) {
  // 1. Attacks and operator actions modify PLC registers/network state.
  const attackState = runActiveAttacks(prev);

  // 2. PLC output registers are converted into plant commands.
  const commandedState = applyPLCToPlant(attackState);

  // 3. Plant physics evolves from those PLC commands.
  const physicsState = updatePlantPhysics(commandedState);

  // 4. Field measurements are written back into PLC input registers.
  const registerState = {
    ...physicsState,
    plc: updatePLCFromPlant(physicsState.plc, physicsState),
  };

  // 5. Existing views receive a read-only projection of the register map.
  const projectedState = projectRegistersToState(registerState);

  // 6. Historian, alarms, events and traffic consume the PLC register state.
  const alarms = evaluateAlarms(projectedState);
  const newEvents = generateEvents(prev, projectedState);
  const normalPackets = generateNormalTraffic(projectedState);
  const exerciseState = evaluateExerciseState(projectedState, alarms);

  return {
    ...projectedState,
    exerciseState,
    alarms,
    activeAlarms: alarms.length,
    events: [...newEvents, ...(projectedState.events || [])].slice(0, 50),
    historian: updateHistorian(prev.historian, projectedState, 50),
    pcapPackets: [
      ...(projectedState.pcapPackets || []),
      ...normalPackets,
    ].slice(-500),
  };
}
