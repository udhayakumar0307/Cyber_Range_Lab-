#!/usr/bin/env python3
"""Scan the OT network for Modbus devices."""
import socket

print("Scanning 172.28.0.0/24 for Modbus TCP (port 502)...\n")
found = []
for i in range(1, 255):
    ip = f"172.28.0.{i}"
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    if sock.connect_ex((ip, 502)) == 0:
        print(f"  [+] FOUND Modbus device at {ip}:502")
        found.append(ip)
    sock.close()

print(f"\nScan complete. Found {len(found)} Modbus device(s).")
