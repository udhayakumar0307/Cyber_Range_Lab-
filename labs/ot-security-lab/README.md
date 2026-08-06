# OT Cybersecurity Simulator

A containerized OT cybersecurity simulation platform for water treatment plant monitoring, attack simulation, packet analysis, and PCAP generation.

## Features

- Water treatment plant HMI simulation
- Attack scenarios for PLC/process manipulation
- Continuous OT network traffic generation
- Mixed protocol traffic:
  - Modbus TCP
  - MQTT
  - OPC UA
  - S7comm
  - DNP3
  - SNMP
  - HTTP
  - ARP
  - ICMP
- PCAP generation from simulated traffic
- PCAP upload and backend parsing
- Conversation tracking
- Session reconstruction
- IOC detection
- Timeline analysis
- Dockerized frontend and backend

## Architecture

Frontend:
- React
- Vite
- Tailwind CSS
- HMI, Historian, Network, PCAP, Instructor, Operations views

Backend:
- FastAPI
- Scapy
- SQLite
- Protocol decoders
- Capture storage
- Analysis endpoints

## Run with Docker Compose

```bash
docker compose up --build
