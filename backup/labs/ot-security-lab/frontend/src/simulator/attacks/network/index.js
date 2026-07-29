import plcDos from "./plcDos";
import modbusScan from "./modbusScan";
import packetInjection from "./packetInjection";
import replayAttack from "./replayAttack";
import packetLoss from "./packetLoss";

export const networkAttacks = {
  PLC_DOS: plcDos,
  MODBUS_SCAN: modbusScan,
  PACKET_INJECTION: packetInjection,
  REPLAY_ATTACK: replayAttack,
  PACKET_LOSS: packetLoss,
};
