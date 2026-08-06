import { createContext, useContext, useEffect, useState } from "react";
import { plantState as initialState } from "../data/plantState";
import { updatePlantPhysics } from "../simulator/plantPhysics";
import { evaluateAlarms } from "../simulator/alarmEngine";
import { generateEvents } from "../simulator/eventEngine";
import { updateHistorian } from "../simulator/historianEngine";
import { runScenario as executeScenario } from "../simulator/scenarioEngine";
import { applyRecoveryAction } from "../simulator/recoveryEngine";
import { evaluateExerciseState } from "../simulator/exerciseEngine";
import { updatePLCFromPlant } from "../simulator/plc/plcEngine";
import { generateNormalTraffic } from "../simulator/trafficEngine";
import { runActiveAttacks } from "../simulator/attackScheduler";
import { runSimulationTick } from "../simulator/simulationEngine";

const PlantContext = createContext();

export function PlantProvider({ children }) {
  const [plant, setPlant] = useState(initialState);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlant((prev) => runSimulationTick(prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function runScenario(scenarioType) {
    setPlant((prev) => {
      const next = executeScenario(prev, scenarioType);
      const alarms = evaluateAlarms(next);
      const exerciseState = evaluateExerciseState(next, alarms);

      return {
        ...next,
        exerciseState,
        alarms,
        activeAlarms: alarms.length,
        events: next.events.slice(0, 20),
        historian: updateHistorian(prev.historian, next, 20),
        pcapPackets: next.pcapPackets || [],
      };
    });
  }

  function studentAction(actionType) {
    setPlant((prev) => {
      const next = applyRecoveryAction(prev, actionType);
      const alarms = evaluateAlarms(next);
      const exerciseState = evaluateExerciseState(next, alarms);

      return {
        ...next,
        exerciseState,
        alarms,
        activeAlarms: alarms.length,
        historian: updateHistorian(prev.historian, next, 20),
        pcapPackets: next.pcapPackets || [],
      };
    });
  }

  return (
    <PlantContext.Provider value={{ plant, runScenario, studentAction }}>
      {children}
    </PlantContext.Provider>
  );
}

export function usePlant() {
  return useContext(PlantContext);
}
