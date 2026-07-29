# OT & ICS Security Simulator Lab — Instructor Guide

## Overview
This lab uses the **SimulOT Operational Technology Cybersecurity Simulator** to provide hands-on experience in industrial control systems (ICS) security, water treatment plant HMI monitoring, Modbus TCP protocol decoding, PLC process manipulation, PCAP network traffic investigation, and SCADA incident response.

---

## Lab Modules

### Module 1: OT Network & Protocol Reconnaissance
- **Focus**: Modbus TCP, MQTT, OPC UA, DNP3 traffic discovery.
- **Goal**: Identify active PLC devices, sensor registers, and SCADA telemetry endpoints.

### Module 2: PLC Register & Process Manipulation
- **Focus**: Unauthorized setpoint changes, coil writes, chemical dosing manipulation.
- **Goal**: Detect and analyze unauthorized Modbus register writes altering water treatment plant physics.

### Module 3: Modbus & S7comm Traffic PCAP Analysis
- **Focus**: Packet capture generation, stream reconstruction, and IOC detection.
- **Goal**: Parse raw industrial PCAP files to identify malicious payload injections and anomalous command sequences.

### Module 4: OT Incident Response & HMI Mitigation
- **Focus**: HMI alarm verification, historian telemetry auditing, and emergency shutdown procedures.
- **Goal**: Formulate incident mitigation workflows and restore normal operating parameters across simulated actuators.

### Module 5: Full Industrial Network Infiltration (Capstone)
- **Focus**: Multi-stage SCADA attack scenario, engineering workstation compromise, and root-cause analysis.
- **Goal**: Conduct complete forensics, mitigate active industrial attacks, and extract capstone solution flags.
