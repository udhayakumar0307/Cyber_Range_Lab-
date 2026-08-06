import Tank from "./Tank";
import Pump from "./Pump";
import Valve from "./Valve";
import Heater from "./Heater";
import Pipe from "./Pipe";
import SensorTag from "./SensorTag";

function getDisplayValue(plant, variable) {
  if (!plant.spoofing?.active) {
    return plant[variable];
  }

  if (plant.spoofing.variable === variable) {
    return plant.spoofing.displayedValue;
  }

  if (plant.spoofing.scope === "HMI") {
    return plant.spoofing.displayedValues?.[variable] ?? plant[variable];
  }

  return plant[variable];
}

export default function PlantCanvas({ plant }) {
  const displayTankLevel = getDisplayValue(plant, "tankLevel");
  const displayFlowRate = getDisplayValue(plant, "flowRate");
  const displayTemperature = getDisplayValue(plant, "temperature");
  const displayChemicalLevel = getDisplayValue(plant, "chemicalLevel");

  const flowActive = plant.flowRate > 5;
  const spoofingActive = plant.spoofing?.active;

  return (
    <section className="mt-8 rounded-2xl bg-[#10253A] border border-[#284A69] p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-semibold">Water Treatment Plant HMI</h2>
          <p className="text-[#94A3B8]">Live process mimic diagram</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-[#94A3B8]">Plant Status</p>
          <p className="text-[#10B981] font-bold">{plant.plantStatus}</p>

          {spoofingActive && (
            <p className="text-[#FBBF24] text-sm mt-2">
              Display Data Integrity Warning
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
        <SensorTag
          tag="LT101"
          label="Tank Level"
          value={displayTankLevel.toFixed(1)}
          unit="%"
          status={
            spoofingActive &&
            (plant.spoofing.variable === "tankLevel" ||
              plant.spoofing.scope === "HMI")
              ? "warning"
              : "normal"
          }
        />

        <SensorTag
          tag="FT101"
          label="Flow Rate"
          value={displayFlowRate.toFixed(1)}
          unit="L/min"
          status={
            spoofingActive &&
            (plant.spoofing.variable === "flowRate" ||
              plant.spoofing.scope === "HMI")
              ? "warning"
              : "normal"
          }
        />

        <SensorTag
          tag="TT101"
          label="Temperature"
          value={displayTemperature.toFixed(1)}
          unit="°C"
          status={
            spoofingActive &&
            (plant.spoofing.variable === "temperature" ||
              plant.spoofing.scope === "HMI")
              ? "warning"
              : "normal"
          }
        />

        <SensorTag
          tag="AT101"
          label="Chemical"
          value={displayChemicalLevel.toFixed(1)}
          unit="ppm"
          status={
            spoofingActive &&
            (plant.spoofing.variable === "chemicalLevel" ||
              plant.spoofing.scope === "HMI")
              ? "warning"
              : "normal"
          }
        />
      </div>

      <div className="flex items-center gap-6">
        <Tank level={displayTankLevel} />
        <Pipe active={flowActive} />
        <Pump status={plant.pumpStatus} />
        <Pipe active={flowActive} />
        <Valve position={plant.valvePosition} />
        <Pipe active={flowActive} />
        <Heater temperature={displayTemperature} />
      </div>
    </section>
  );
}
