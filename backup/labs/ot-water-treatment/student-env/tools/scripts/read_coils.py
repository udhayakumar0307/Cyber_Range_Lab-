#!/usr/bin/env python3
"""Read all coil states from the PLC."""
from pymodbus.client import ModbusTcpClient

client = ModbusTcpClient('172.28.0.10', port=502)
client.connect()
result = client.read_coils(0, 8, slave=0)

names = ["Intake Pump","Treatment Pump","Distribution Valve",
         "Chemical Dosing","Emergency Shutdown","Backwash Cycle",
         "Alarm Acknowledge","Maintenance Mode"]

print("=" * 45)
print("  PLC COIL STATUS")
print("=" * 45)
for i, val in enumerate(result.bits[:8]):
    state = "ON ✅" if val else "OFF ❌"
    print(f"  C{i}  |  {state:>8}  |  {names[i]}")
print("=" * 45)
client.close()
