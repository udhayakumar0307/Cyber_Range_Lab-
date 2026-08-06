#!/usr/bin/env python3
"""Read all holding registers from the PLC."""
from pymodbus.client import ModbusTcpClient

client = ModbusTcpClient('172.28.0.10', port=502)
client.connect()
result = client.read_holding_registers(0, 20, slave=0)

names = [
    "Intake Pump Speed (%)", "Raw Water Flow (L/min)", "Tank Level (%)",
    "pH (x100)", "Chlorine (x100 mg/L)", "Treatment Pump (%)",
    "Pressure (x10 PSI)", "Treated Flow (L/min)", "Temperature (x10 °C)",
    "Turbidity (x10 NTU)", "TDS (ppm)", "Conductivity (µS/cm)",
    "Dissolved O2 (x10)", "ORP (mV)", "Filter DP (x10 PSI)",
    "Backwash Timer (s)", "Daily Volume (x10 m³)", "Alarm Code",
    "Uptime (min)", "??? (Secret)"
]

print("=" * 55)
print("  PLC REGISTER DUMP — Water Treatment Plant")
print("=" * 55)
for i, val in enumerate(result.registers):
    name = names[i] if i < len(names) else f"Register {i}"
    print(f"  R{i:02d}  |  {val:>6}  |  {name}")
print("=" * 55)
client.close()
