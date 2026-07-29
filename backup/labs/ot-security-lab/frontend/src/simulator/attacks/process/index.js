import stopPump from "./stopPump";
import closeValve from "./closeValve";
import heaterRunaway from "./heaterRunaway";
import heaterShutdown from "./heaterShutdown";
import chemicalOverdose from "./chemicalOverdose";
import chemicalUnderdose from "./chemicalUnderdose";

export const processAttacks = {
  STOP_PUMP: stopPump,
  CLOSE_VALVE: closeValve,
  HEATER_RUNAWAY: heaterRunaway,
  HEATER_SHUTDOWN: heaterShutdown,
  CHEMICAL_OVERDOSE: chemicalOverdose,
  CHEMICAL_UNDERDOSE: chemicalUnderdose,
};
