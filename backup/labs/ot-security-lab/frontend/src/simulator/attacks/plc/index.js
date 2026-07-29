import unauthorizedRegisterWrite from "./unauthorizedRegisterWrite";
import multipleRegisterAttack from "./multipleRegisterAttack";
import engineeringWorkstationCompromise from "./engineeringWorkstationCompromise";
import unauthorizedSetpointChange from "./unauthorizedSetpointChange";

export const plcAttacks = {
  UNAUTHORIZED_REGISTER_WRITE: unauthorizedRegisterWrite,
  MULTIPLE_REGISTER_ATTACK: multipleRegisterAttack,
  ENGINEERING_WORKSTATION_COMPROMISE: engineeringWorkstationCompromise,
  UNAUTHORIZED_SETPOINT_CHANGE: unauthorizedSetpointChange,
};
