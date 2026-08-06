export function generateEvents(prev, next) {
  const events = [];

  if (prev.pumpStatus !== next.pumpStatus) {
    events.push({
      time: new Date().toLocaleTimeString(),
      source: "PLC",
      message: `Pump status changed: ${prev.pumpStatus} → ${next.pumpStatus}`,
      severity: "INFO",
    });
  }

  if (prev.valvePosition !== next.valvePosition) {
    events.push({
      time: new Date().toLocaleTimeString(),
      source: "PLC",
      message: `Valve position changed: ${prev.valvePosition}% → ${next.valvePosition}%`,
      severity: "INFO",
    });
  }

  if (next.tankLevel > 90 && prev.tankLevel <= 90) {
    events.push({
      time: new Date().toLocaleTimeString(),
      source: "Alarm Engine",
      message: "High tank level alarm triggered",
      severity: "HIGH",
    });
  }

  if (next.temperature > 75 && prev.temperature <= 75) {
    events.push({
      time: new Date().toLocaleTimeString(),
      source: "Alarm Engine",
      message: "High temperature alarm triggered",
      severity: "HIGH",
    });
  }

  if (next.flowRate < 5 && prev.flowRate >= 5) {
    events.push({
      time: new Date().toLocaleTimeString(),
      source: "Alarm Engine",
      message: "Low flow condition detected",
      severity: "MEDIUM",
    });
  }

  return events;
}
