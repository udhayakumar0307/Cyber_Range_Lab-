"""
SCADA / HMI Dashboard — Water Treatment Plant
Real-time web dashboard reading from the PLC via Modbus TCP.
"""

import os
import time
import threading
from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO
from pymodbus.client import ModbusTcpClient

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

PLC_HOST = os.environ.get("PLC_HOST", "172.28.0.10")
PLC_PORT = int(os.environ.get("PLC_PORT", "502"))

REGISTER_MAP = {
    0: {"name": "Intake Pump Speed", "unit": "%", "scale": 1},
    1: {"name": "Raw Water Flow", "unit": "L/min", "scale": 1},
    2: {"name": "Tank Level", "unit": "%", "scale": 1},
    3: {"name": "pH Value", "unit": "", "scale": 0.01},
    4: {"name": "Chlorine", "unit": "mg/L", "scale": 0.01},
    5: {"name": "Treatment Pump Speed", "unit": "%", "scale": 1},
    6: {"name": "Distribution Pressure", "unit": "PSI", "scale": 0.1},
    7: {"name": "Treated Water Flow", "unit": "L/min", "scale": 1},
    8: {"name": "Temperature", "unit": "°C", "scale": 0.1},
    9: {"name": "Turbidity", "unit": "NTU", "scale": 0.1},
    10: {"name": "TDS", "unit": "ppm", "scale": 1},
    11: {"name": "Conductivity", "unit": "µS/cm", "scale": 1},
    12: {"name": "Dissolved Oxygen", "unit": "mg/L", "scale": 0.1},
    13: {"name": "ORP", "unit": "mV", "scale": 1},
    14: {"name": "Filter ΔP", "unit": "PSI", "scale": 0.1},
    15: {"name": "Backwash Timer", "unit": "sec", "scale": 1},
    16: {"name": "Daily Volume", "unit": "m³", "scale": 0.1},
    17: {"name": "Alarm Code", "unit": "", "scale": 1},
    18: {"name": "System Uptime", "unit": "min", "scale": 1},
}

ALARM_CODES = {
    0: "OK",
    1: "pH Out of Range",
    2: "Chlorine Out of Range",
    3: "Pressure Anomaly",
    4: "Tank Level Critical",
    5: "Flow Anomaly",
    99: "EMERGENCY SHUTDOWN",
}

COIL_NAMES = [
    "Intake Pump",
    "Treatment Pump",
    "Distribution Valve",
    "Chemical Dosing",
    "Emergency Shutdown",
    "Backwash Cycle",
    "Alarm Acknowledge",
    "Maintenance Mode",
]


def poll_plc():
    """Background thread: read PLC every 2 seconds, push to frontend."""
    while True:
        try:
            client = ModbusTcpClient(PLC_HOST, port=PLC_PORT, timeout=3)
            if client.connect():
                rr = client.read_holding_registers(0, 20, slave=0)
                rc = client.read_coils(0, 8, slave=0)
                client.close()

                if not rr.isError() and not rc.isError():
                    regs = rr.registers
                    coils = rc.bits[:8]

                    data = {"registers": {}, "coils": {}, "alarm": "", "timestamp": time.time()}
                    for addr, meta in REGISTER_MAP.items():
                        raw = regs[addr] if addr < len(regs) else 0
                        data["registers"][meta["name"]] = {
                            "value": round(raw * meta["scale"], 2),
                            "unit": meta["unit"],
                            "raw": raw,
                            "address": addr,
                        }

                    for i, name in enumerate(COIL_NAMES):
                        data["coils"][name] = coils[i] if i < len(coils) else False

                    alarm_code = regs[17] if 17 < len(regs) else 0
                    data["alarm"] = ALARM_CODES.get(alarm_code, f"Unknown ({alarm_code})")
                    data["alarm_code"] = alarm_code

                    socketio.emit("plc_data", data)
        except Exception as e:
            print(f"PLC poll error: {e}")

        time.sleep(2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def api_status():
    try:
        client = ModbusTcpClient(PLC_HOST, port=PLC_PORT, timeout=3)
        if client.connect():
            rr = client.read_holding_registers(0, 20, slave=0)
            rc = client.read_coils(0, 8, slave=0)
            client.close()
            if not rr.isError():
                return jsonify({"status": "online", "registers": rr.registers, "coils": rc.bits[:8]})
        return jsonify({"status": "offline"})
    except:
        return jsonify({"status": "error"})


if __name__ == "__main__":
    import threading
    t = threading.Thread(target=poll_plc, daemon=True)
    t.start()
    print("=" * 50, flush=True)
    print("  SCADA HMI Dashboard — http://0.0.0.0:3000", flush=True)
    print("=" * 50, flush=True)
    socketio.run(app, host="0.0.0.0", port=3000, debug=False, allow_unsafe_werkzeug=True)
