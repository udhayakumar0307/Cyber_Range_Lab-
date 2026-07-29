"""
Water Treatment Plant PLC Simulator
Simulates a realistic water treatment process with Modbus TCP interface.

HOLDING REGISTERS (address : description : unit):
  0  : Intake Pump Speed       : 0-100 %
  1  : Raw Water Flow Rate     : L/min
  2  : Reservoir Tank Level    : 0-100 %
  3  : pH Value                : x100 (e.g. 700 = 7.00)
  4  : Chlorine Dosing Rate    : x100 mg/L
  5  : Treatment Pump Speed    : 0-100 %
  6  : Distribution Pressure   : x10 PSI
  7  : Treated Water Flow Rate : L/min
  8  : Water Temperature       : x10 °C
  9  : Turbidity               : x10 NTU
  10 : Total Dissolved Solids  : ppm
  11 : Conductivity            : µS/cm
  12 : Dissolved Oxygen        : x10 mg/L
  13 : ORP (Redox Potential)   : mV
  14 : Filter Differential P   : x10 PSI
  15 : Backwash Timer          : seconds
  16 : Daily Volume Treated    : x10 m³
  17 : Alarm Code              : 0=OK, 1=pH, 2=Cl, 3=Pressure, 4=Level, 5=Flow
  18 : System Uptime           : minutes
  19 : FLAG Register (secret)  : hidden value

COILS (address : description):
  0  : Intake Pump ON/OFF
  1  : Treatment Pump ON/OFF
  2  : Distribution Valve OPEN/CLOSE
  3  : Chemical Dosing ENABLED/DISABLED
  4  : Emergency Shutdown ACTIVE
  5  : Backwash Cycle ACTIVE
  6  : Alarm Acknowledge
  7  : Maintenance Mode
"""

import threading
import time
import random
import math
import logging

from pymodbus.datastore import (
    ModbusSequentialDataBlock,
    ModbusSlaveContext,
    ModbusServerContext,
)
from pymodbus.server import StartTcpServer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("PLC")

# --- Initial register/coil values ---
INITIAL_REGISTERS = [0] * 100
INITIAL_REGISTERS[0] = 45      # Intake pump speed 45%
INITIAL_REGISTERS[1] = 120     # Raw water flow 120 L/min
INITIAL_REGISTERS[2] = 55      # Tank level 55%
INITIAL_REGISTERS[3] = 710     # pH 7.10
INITIAL_REGISTERS[4] = 150     # Chlorine 1.50 mg/L
INITIAL_REGISTERS[5] = 40      # Treatment pump 40%
INITIAL_REGISTERS[6] = 450     # Pressure 45.0 PSI
INITIAL_REGISTERS[7] = 95      # Treated flow 95 L/min
INITIAL_REGISTERS[8] = 220     # Temperature 22.0°C
INITIAL_REGISTERS[9] = 35      # Turbidity 3.5 NTU
INITIAL_REGISTERS[10] = 320    # TDS 320 ppm
INITIAL_REGISTERS[11] = 480    # Conductivity 480 µS/cm
INITIAL_REGISTERS[12] = 82     # DO 8.2 mg/L
INITIAL_REGISTERS[13] = 650    # ORP 650 mV
INITIAL_REGISTERS[14] = 25     # Filter DP 2.5 PSI
INITIAL_REGISTERS[15] = 0      # Backwash timer
INITIAL_REGISTERS[16] = 0      # Daily volume
INITIAL_REGISTERS[17] = 0      # Alarm code
INITIAL_REGISTERS[18] = 0      # Uptime
INITIAL_REGISTERS[19] = 31337  # FLAG — students need to find this

INITIAL_COILS = [False] * 20
INITIAL_COILS[0] = True   # Intake pump ON
INITIAL_COILS[1] = True   # Treatment pump ON
INITIAL_COILS[2] = True   # Distribution valve OPEN
INITIAL_COILS[3] = True   # Chemical dosing ENABLED
INITIAL_COILS[4] = False  # Emergency shutdown OFF
INITIAL_COILS[5] = False  # Backwash OFF
INITIAL_COILS[6] = False  # Alarm ack OFF
INITIAL_COILS[7] = False  # Maintenance OFF


def process_simulation(context):
    """Simulate realistic water treatment plant physics."""
    slave_id = 0x00
    uptime = 0
    daily_volume = 0.0
    float_tank = 55.0

    while True:
        try:
            time.sleep(1)
            uptime += 1

            regs = context[slave_id].getValues(3, 0, count=20)   # holding registers
            coils = context[slave_id].getValues(1, 0, count=8)    # coils

            intake_on = coils[0]
            treat_on = coils[1]
            valve_open = coils[2]
            dosing_on = coils[3]
            e_stop = coils[4]
            backwash = coils[5]
            maint = coils[7]

            t = time.time()
            noise = lambda scale=1.0: random.gauss(0, scale)

            # --- Emergency shutdown overrides everything ---
            if e_stop:
                new_regs = [0] * 20
                new_regs[17] = 99   # alarm: e-stop
                new_regs[18] = uptime
                new_regs[19] = regs[19]
                context[slave_id].setValues(3, 0, new_regs)
                continue

            # --- Intake pump ---
            intake_speed = regs[0] if intake_on and not maint else 0
            raw_flow = max(0, int(intake_speed * 2.8 + noise(3)))

            # --- Tank level ---
            inflow = raw_flow * 0.005   # Lower inflow multiplier
            treat_speed = regs[5] if treat_on else 0
            outflow = treat_speed * 0.015  # Higher outflow multiplier
            
            # Add auto-balancing: if tank gets high, outflow naturally increases (gravity)
            gravity_assist = (float_tank - 50) * 0.005 if float_tank > 50 else 0
            outflow += gravity_assist
            
            float_tank = max(0, min(100, float_tank + inflow - outflow + noise(0.1)))
            tank = int(float_tank)

            # --- Water quality ---
            base_ph = 710 + 20 * math.sin(t / 300) + noise(5)
            if dosing_on:
                base_ph = max(680, min(740, base_ph))
            ph = int(base_ph)

            chlorine = int(150 + 10 * math.sin(t / 200) + noise(3)) if dosing_on else int(50 + noise(5))

            # --- Treatment output ---
            treated_flow = max(0, int(treat_speed * 2.4 + noise(2))) if valve_open else 0

            # --- Pressure ---
            pressure = int(400 + treat_speed * 1.2 + noise(5)) if valve_open else int(100 + noise(3))

            # --- Other sensors ---
            temp = int(220 + 15 * math.sin(t / 600) + noise(2))
            turbidity = int(35 + 10 * math.sin(t / 400) + noise(2))
            tds = int(320 + noise(5))
            conductivity = int(480 + noise(8))
            do_val = int(82 + noise(3))
            orp = int(650 + noise(10))
            filter_dp = int(25 + noise(1))

            # --- Backwash ---
            bw_timer = 0
            if backwash:
                bw_timer = regs[15] + 1
                if bw_timer > 120:
                    context[slave_id].setValues(1, 5, [False])
                    bw_timer = 0

            # --- Daily volume ---
            daily_volume += treated_flow / 60000.0  # m³
            daily_vol_reg = int(daily_volume * 10)

            # --- Alarms ---
            alarm = 0
            if ph < 650 or ph > 780:
                alarm = 1
            elif chlorine < 80 or chlorine > 300:
                alarm = 2
            elif pressure > 700 or pressure < 200:
                alarm = 3
            elif tank > 95 or tank < 10:
                alarm = 4
            elif raw_flow < 10 and intake_on:
                alarm = 5

            if alarm > 0:
                context[slave_id].setValues(1, 6, [True])  # set alarm acknowledge coil as indicator instead of E-Stop

            # --- Write updated registers ---
            new_regs = list(regs)
            new_regs[0] = int(intake_speed)
            new_regs[1] = int(raw_flow)
            new_regs[2] = tank
            new_regs[3] = ph
            new_regs[4] = chlorine
            new_regs[5] = treat_speed
            new_regs[6] = pressure
            new_regs[7] = treated_flow
            new_regs[8] = temp
            new_regs[9] = turbidity
            new_regs[10] = tds
            new_regs[11] = conductivity
            new_regs[12] = do_val
            new_regs[13] = orp
            new_regs[14] = filter_dp
            new_regs[15] = bw_timer
            new_regs[16] = daily_vol_reg
            new_regs[17] = alarm
            new_regs[18] = uptime // 60
            # new_regs[19] is the FLAG — don't overwrite it

            context[slave_id].setValues(3, 0, new_regs)

            if uptime % 30 == 0:
                log.info(
                    f"Tank={tank}% pH={ph/100:.2f} Cl={chlorine/100:.2f} "
                    f"Flow_in={raw_flow} Flow_out={treated_flow} P={pressure/10:.1f}PSI "
                    f"Alarm={alarm}"
                )

        except Exception as e:
            log.error(f"Simulation error: {e}")
            time.sleep(1)


def run_server():
    hr_block = ModbusSequentialDataBlock(0, INITIAL_REGISTERS)
    co_block = ModbusSequentialDataBlock(0, [v if isinstance(v, bool) else bool(v) for v in INITIAL_COILS] + [False]*80)
    di_block = ModbusSequentialDataBlock(0, [False] * 100)
    ir_block = ModbusSequentialDataBlock(0, [0] * 100)

    slave = ModbusSlaveContext(
        di=di_block,
        co=co_block,
        hr=hr_block,
        ir=ir_block,
        zero_mode=True,
    )
    context = ModbusServerContext(slaves=slave, single=True)

    sim_thread = threading.Thread(target=process_simulation, args=(context,), daemon=True)
    sim_thread.start()

    log.info("=" * 60)
    log.info("  WATER TREATMENT PLANT PLC — Modbus TCP Server")
    log.info("  Listening on 0.0.0.0:502")
    log.info("  20 Holding Registers | 8 Coils | 1-second scan cycle")
    log.info("=" * 60)

    StartTcpServer(context=context, address=("0.0.0.0", 502))


if __name__ == "__main__":
    run_server()
