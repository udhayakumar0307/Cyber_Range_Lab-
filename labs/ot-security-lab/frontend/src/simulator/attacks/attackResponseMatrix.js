function recoveryLabel(action) {
  const labels = {
    START_PUMP: "Restart Pump",
    OPEN_VALVE: "Restore Valve Position",
    RESET_HEATER: "Restore Heater Control",
    RESET_CHEMICAL: "Normalize Chemical Target",
    RESTORE_PROCESS: "Restore PLC Process State",
  };
  return labels[action] || action;
}

const processWorkflow = (recoveryAction) => [
  { action: "IDENTIFY_EWS_SOURCE", phase: "INVESTIGATE", label: "Confirm EWS as Command Source" },
  { action: "ISOLATE_EWS", phase: "CONTAIN", label: "Isolate Engineering WS" },
  { action: "VERIFY_REGISTER_VALUES", phase: "INVESTIGATE", label: "Inspect Affected PLC Register" },
  { action: recoveryAction, phase: "RECOVER", label: recoveryLabel(recoveryAction) },
  { action: "START_STABILITY_WINDOW", phase: "VERIFY", label: "Start Process Stability Window" },
  { action: "WAIT_FOR_PROCESS_STABILITY", phase: "VERIFY", label: "Wait 3 Seconds for Stable Trend", minWaitMs: 3000, timerField: "stabilityWindowStartedAt" },
  { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Process and Alarms" },
  { action: "RECONNECT_EWS", phase: "RESTORE", label: "Restore Engineering WS" },
];

export const attackResponseMatrix = [
  { id: "STOP_PUMP", title: "Stop Pump Attack", category: "PROCESS", workflow: processWorkflow("START_PUMP") },
  { id: "CLOSE_VALVE", title: "Close Valve Attack", category: "PROCESS", workflow: processWorkflow("OPEN_VALVE") },
  { id: "HEATER_RUNAWAY", title: "Heater Runaway", category: "PROCESS", workflow: processWorkflow("RESET_HEATER") },
  { id: "HEATER_SHUTDOWN", title: "Heater Shutdown", category: "PROCESS", workflow: processWorkflow("RESET_HEATER") },
  { id: "CHEMICAL_OVERDOSE", title: "Chemical Overdose", category: "PROCESS", workflow: processWorkflow("RESET_CHEMICAL") },
  { id: "CHEMICAL_UNDERDOSE", title: "Chemical Underdose", category: "PROCESS", workflow: processWorkflow("RESET_CHEMICAL") },

  {
    id: "MODBUS_SCAN", title: "Modbus Reconnaissance Scan", category: "NETWORK",
    workflow: [
      { action: "REVIEW_TRAFFIC_PATTERN", phase: "INVESTIGATE", label: "Confirm Abnormal FC03 Scan Pattern" },
      { action: "BLOCK_SOURCE", phase: "CONTAIN", label: "Block Unknown Source" },
      { action: "START_CLEAN_TRAFFIC_WINDOW", phase: "VERIFY", label: "Start Clean Traffic Window" },
      { action: "WAIT_FOR_CLEAN_TRAFFIC", phase: "VERIFY", label: "Wait 3 Seconds for Scan Traffic to Stop", minWaitMs: 3000, timerField: "cleanTrafficWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Normal Polling Only" },
    ],
  },
  {
    id: "PACKET_INJECTION", title: "Packet Injection", category: "NETWORK",
    workflow: [
      { action: "VERIFY_SOURCE_IDENTITY", phase: "INVESTIGATE", label: "Confirm Rogue Device Identity" },
      { action: "BLOCK_SOURCE", phase: "CONTAIN", label: "Block Forged Source" },
      { action: "VERIFY_REGISTER_VALUES", phase: "INVESTIGATE", label: "Inspect Modified PLC Register" },
      { action: "RESTORE_PROCESS", phase: "RECOVER", label: "Restore PLC Process State" },
      { action: "START_STABILITY_WINDOW", phase: "VERIFY", label: "Start Process Stability Window" },
      { action: "WAIT_FOR_PROCESS_STABILITY", phase: "VERIFY", label: "Wait 3 Seconds for Stable Trend", minWaitMs: 3000, timerField: "stabilityWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify No Further Injection" },
    ],
  },
  {
    id: "PACKET_LOSS", title: "Network Packet Loss", category: "NETWORK",
    workflow: [
      { action: "CHECK_NETWORK", phase: "INVESTIGATE", label: "Inspect Loss and Latency" },
      { action: "RESTORE_NETWORK", phase: "RECOVER", label: "Restore Network Path" },
      { action: "START_CLEAN_TRAFFIC_WINDOW", phase: "VERIFY", label: "Start Communication Observation Window" },
      { action: "WAIT_FOR_CLEAN_TRAFFIC", phase: "VERIFY", label: "Wait 3 Seconds for Stable Communications", minWaitMs: 3000, timerField: "cleanTrafficWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Stable Communications" },
    ],
  },
  {
    id: "PLC_DOS", title: "PLC Denial of Service", category: "NETWORK",
    workflow: [
      { action: "REVIEW_TRAFFIC_PATTERN", phase: "INVESTIGATE", label: "Confirm Flood and PLC Timeout" },
      { action: "ISOLATE_NETWORK", phase: "CONTAIN", label: "Isolate Affected Segment" },
      { action: "RESTART_PLC", phase: "RECOVER", label: "Restart PLC Communications" },
      { action: "RESTORE_NETWORK", phase: "RESTORE", label: "Restore Network" },
      { action: "START_CLEAN_TRAFFIC_WINDOW", phase: "VERIFY", label: "Start Communication Observation Window" },
      { action: "WAIT_FOR_CLEAN_TRAFFIC", phase: "VERIFY", label: "Wait 3 Seconds for PLC Polling", minWaitMs: 3000, timerField: "cleanTrafficWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify PLC Communications" },
    ],
  },
  {
    id: "REPLAY_ATTACK", title: "Replay Attack", category: "NETWORK",
    workflow: [
      { action: "REVIEW_TRAFFIC_PATTERN", phase: "INVESTIGATE", label: "Confirm Duplicate Modbus Transaction" },
      { action: "BLOCK_SOURCE", phase: "CONTAIN", label: "Block Replay Source" },
      { action: "VERIFY_CURRENT_STATE", phase: "INVESTIGATE", label: "Verify Current Process State" },
      { action: "RESTORE_PROCESS", phase: "RECOVER", label: "Restore PLC Process State" },
      { action: "START_CLEAN_TRAFFIC_WINDOW", phase: "VERIFY", label: "Start Duplicate-Free Window" },
      { action: "WAIT_FOR_CLEAN_TRAFFIC", phase: "VERIFY", label: "Wait 3 Seconds for Duplicate Traffic to Stop", minWaitMs: 3000, timerField: "cleanTrafficWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Duplicate Commands Stopped" },
    ],
  },

  {
    id: "UNAUTHORIZED_REGISTER_WRITE", title: "Unauthorized Register Write", category: "PLC",
    workflow: [
      { action: "VERIFY_SOURCE_IDENTITY", phase: "INVESTIGATE", label: "Confirm Unauthorized Writer" },
      { action: "BLOCK_SOURCE", phase: "CONTAIN", label: "Block Unknown Source" },
      { action: "VERIFY_REGISTER_VALUES", phase: "INVESTIGATE", label: "Inspect PLC Registers" },
      { action: "RESTORE_PROCESS", phase: "RECOVER", label: "Restore PLC Process State" },
      { action: "START_STABILITY_WINDOW", phase: "VERIFY", label: "Start Process Stability Window" },
      { action: "WAIT_FOR_PROCESS_STABILITY", phase: "VERIFY", label: "Wait 3 Seconds for Stable Trend", minWaitMs: 3000, timerField: "stabilityWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Register Integrity" },
    ],
  },
  { id: "UNAUTHORIZED_SETPOINT_CHANGE", title: "Unauthorized Setpoint Change", category: "PLC", workflow: processWorkflow("RESET_CHEMICAL") },
  { id: "MULTIPLE_REGISTER_ATTACK", title: "Multiple Register Attack", category: "PLC", workflow: processWorkflow("RESTORE_PROCESS") },
  { id: "ENGINEERING_WORKSTATION_COMPROMISE", title: "Engineering Workstation Compromise", category: "PLC", workflow: processWorkflow("RESTORE_PROCESS") },

  {
    id: "IP_SPOOFING", title: "IP Spoofing", category: "SPOOFING",
    workflow: [
      { action: "REVIEW_ASSET_INVENTORY", phase: "INVESTIGATE", label: "Review Trusted Asset Inventory" },
      { action: "VERIFY_SOURCE_IDENTITY", phase: "INVESTIGATE", label: "Compare IP and Device Identity" },
      { action: "BLOCK_SOURCE", phase: "CONTAIN", label: "Block Actual Rogue Source" },
      { action: "START_CLEAN_TRAFFIC_WINDOW", phase: "VERIFY", label: "Start Clean Traffic Window" },
      { action: "WAIT_FOR_CLEAN_TRAFFIC", phase: "VERIFY", label: "Wait 3 Seconds for Spoofed Traffic to Stop", minWaitMs: 3000, timerField: "cleanTrafficWindowStartedAt" },
      { action: "VERIFY_RECOVERY", phase: "VERIFY", label: "Verify Trusted Sources Only" },
    ],
  },
  {
    id: "FALSE_HMI_DATA", title: "HMI Data Spoofing", category: "SPOOFING",
    workflow: [
      { action: "COMPARE_HMI_PLC", phase: "INVESTIGATE", label: "Compare HMI, PLC, and Historian Values" },
      { action: "ISOLATE_HMI_DATA_PATH", phase: "CONTAIN", label: "Isolate Compromised HMI Data Path" },
      { action: "START_TRUSTED_REFRESH", phase: "RECOVER", label: "Request Fresh Trusted PLC Poll" },
      { action: "WAIT_FOR_TRUSTED_UPDATE", phase: "RECOVER", label: "Wait 3 Seconds for Trusted Update", minWaitMs: 3000, timerField: "trustedRefreshStartedAt" },
      { action: "RESTORE_HMI_DATA", phase: "RECOVER", label: "Apply Trusted HMI Values" },
      { action: "VERIFY_HMI_MATCH", phase: "VERIFY", label: "Verify HMI Matches PLC and Historian" },
    ],
  },
];

export function getAttackResponse(attackId) {
  return attackResponseMatrix.find((entry) => entry.id === attackId) || null;
}

export function getExpectedAction(state) {
  const active = (state.activeAttacks || []).find((attack) => !attack.completed);
  if (!active) return null;
  const response = getAttackResponse(active.id);
  return response?.workflow?.[active.workflowIndex || 0] || null;
}
