import { getAttackResponse } from "./attacks/attackResponseMatrix";

export function getCurrentIncident(state) {
  return (state.activeAttacks || []).find((attack) => !attack.completed) || null;
}

export function getWorkflowStatus(state) {
  const incident = getCurrentIncident(state);
  if (!incident) return null;
  const response = getAttackResponse(incident.id);
  if (!response) return null;

  const index = incident.workflowIndex || 0;
  return { incident, response, index, expected: response.workflow[index] || null, complete: index >= response.workflow.length };
}

export function validateResponseAction(state, actionType) {
  const status = getWorkflowStatus(state);
  if (!status) return { allowed: true, status: null };
  if (!status.expected) return { allowed: false, status, reason: "Incident workflow is already complete" };
  if (status.expected.action !== actionType) {
    return { allowed: false, status, reason: `Complete ${status.expected.label} before performing another action` };
  }

  if (status.expected.minWaitMs && status.expected.timerField) {
    const startedAt = status.incident[status.expected.timerField];
    if (!startedAt) {
      return { allowed: false, status, reason: "Start the required observation window first" };
    }
    const remaining = status.expected.minWaitMs - (Date.now() - startedAt);
    if (remaining > 0) {
      return { allowed: false, status, reason: `Observation period incomplete. Wait ${Math.ceil(remaining / 1000)} more second(s)` };
    }
  }

  return { allowed: true, status };
}

export function advanceResponseWorkflow(state, actionType) {
  const status = getWorkflowStatus(state);
  if (!status || status.expected?.action !== actionType) return state;

  const now = new Date().toLocaleTimeString();
  const nextIndex = status.index + 1;
  const finished = nextIndex >= status.response.workflow.length;
  const timerUpdates = {};
  if (actionType === "START_TRUSTED_REFRESH") timerUpdates.trustedRefreshStartedAt = Date.now();
  if (actionType === "START_CLEAN_TRAFFIC_WINDOW") timerUpdates.cleanTrafficWindowStartedAt = Date.now();
  if (actionType === "START_STABILITY_WINDOW") timerUpdates.stabilityWindowStartedAt = Date.now();

  return {
    ...state,
    activeAttacks: (state.activeAttacks || []).map((attack) =>
      attack === status.incident
        ? {
            ...attack,
            ...timerUpdates,
            workflowIndex: nextIndex,
            responseHistory: [...(attack.responseHistory || []), { action: actionType, phase: status.expected.phase, time: now }],
            contained: attack.contained || status.expected.phase === "CONTAIN",
            completed: finished,
            completedAt: finished ? now : attack.completedAt,
          }
        : attack
    ),
    activeScenario: finished ? "Normal Operation" : state.activeScenario,
  };
}
