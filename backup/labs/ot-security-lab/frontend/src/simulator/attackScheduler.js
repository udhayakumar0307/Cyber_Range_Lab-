import { applyAttack } from "./attackEngine";
import { getAttackDefinition } from "./attacks";

export function getDeviceStatus(state, deviceId) {
  return (state.networkDevices || []).find((device) => device.id === deviceId)?.status;
}

export function isEwsIsolated(state) {
  return ["OFFLINE", "ISOLATED"].includes(getDeviceStatus(state, "EWS01"));
}

export function attackSource(attackId) {
  const attack = getAttackDefinition(attackId);
  return attack?.source || attack?.pcap?.source || attack?.network?.compromisedDevice || null;
}

export function isAttackSourceBlocked(state, attackId) {
  return attackSource(attackId) === "EWS01" && isEwsIsolated(state);
}

export function runActiveAttacks(state) {
  const activeAttacks = state.activeAttacks || [];

  if (activeAttacks.length === 0) return state;

  let next = { ...state };
  const now = Date.now();

  activeAttacks.forEach((active) => {
    if (active.contained || isAttackSourceBlocked(next, active.id)) return;

    const definition = getAttackDefinition(active.id);
    const repeatMs = definition?.repeatIntervalMs ??
      (definition?.category === "PROCESS" || definition?.category === "PLC" ? 3000 : 5000);

    if (active.lastAppliedEpochMs && now - active.lastAppliedEpochMs < repeatMs) return;

    next = applyAttack(next, active.id);
    next = {
      ...next,
      activeAttacks: (next.activeAttacks || []).map((item) =>
        item.id === active.id && !item.contained
          ? { ...item, lastAppliedEpochMs: now }
          : item
      ),
    };
  });

  return next;
}

export function addActiveAttack(state, attackId) {
  const existing = state.activeAttacks || [];

  // Do not add a duplicate while the same attack is still active.
  // A contained attack is historical only, so the instructor can launch it again later.
  if (isAttackSourceBlocked(state, attackId)) {
    return {
      ...state,
      events: [
        {
          time: new Date().toLocaleTimeString(),
          source: "Attack Engine",
          severity: "INFO",
          message: `Attack ${attackId} blocked because EWS01 is isolated`,
        },
        ...(state.events || []),
      ].slice(0, 50),
    };
  }

  if (existing.some((attack) => attack.id === attackId && !attack.contained)) {
    return state;
  }

  return {
    ...state,
    activeAttacks: [
      ...existing,
      {
        id: attackId,
        startedAt: new Date().toLocaleTimeString(),
        contained: false,
        completed: false,
        workflowIndex: 0,
        responseHistory: [],
        lastAppliedEpochMs: Date.now(),
      },
    ],
  };
}

function actionContainsAttack(actionType, attackId) {
  const attack = getAttackDefinition(attackId);
  if (!attack) return false;

  const source = attack.source || attack.pcap?.source;

  switch (actionType) {
    case "ISOLATE_EWS":
      return source === "EWS01" || attack.network?.compromisedDevice === "EWS01";

    case "BLOCK_SOURCE":
      return (
        source === "UNKNOWN" ||
        attack.network?.scanSource === "UNKNOWN" ||
        attack.network?.forgedSource === "192.168.1.250" ||
        attack.network?.actualSource === "UNKNOWN" ||
        attack.network?.actualSourceIp === "192.168.1.250"
      );

    case "ISOLATE_NETWORK":
      return attack.id === "PLC_DOS";

    case "RESTART_PLC":
      return attack.id === "PLC_DOS";

    case "RESTORE_NETWORK":
      return ["PACKET_LOSS", "PLC_DOS"].includes(attack.id);

    case "RESTORE_SENSOR_DATA":
      return false;

    case "RESTORE_HMI_DATA":
      return attack.id === "FALSE_HMI_DATA";

    case "VERIFY_CURRENT_STATE":
      return attack.id === "REPLAY_ATTACK";

    case "VERIFY_REGISTER_VALUES":
      return ["UNAUTHORIZED_REGISTER_WRITE", "PACKET_INJECTION"].includes(attack.id);

    default:
      return false;
  }
}

export function containAttacksByAction(state, actionType) {
  const activeAttacks = state.activeAttacks || [];

  return {
    ...state,
    activeAttacks: activeAttacks.map((attack) => {
      if (attack.contained || !actionContainsAttack(actionType, attack.id)) {
        return attack;
      }

      return {
        ...attack,
        contained: true,
        containedAt: new Date().toLocaleTimeString(),
        containmentAction: actionType,
      };
    }),
  };
}
