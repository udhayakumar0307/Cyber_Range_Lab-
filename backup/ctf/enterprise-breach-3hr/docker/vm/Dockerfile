# Team desktop VM: full Linux desktop (LXDE) with Chromium, a terminal, and a
# file manager, reachable in-browser via noVNC on port 6080. Based on the
# well-established dorowu/ubuntu-desktop-lxde-vnc image so the VNC/websocket
# stack itself doesn't need to be built from scratch - we only layer our
# challenge tools and files on top.
FROM dorowu/ubuntu-desktop-lxde-vnc:focal

# Recon/exploitation tooling needed for the Network + Web challenges
RUN apt-get update && apt-get install -y --no-install-recommends \
        nmap \
        netcat \
        curl \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Drop the Cryptography challenge files onto the desktop for the team to find
RUN mkdir -p /root/Desktop/challenge
COPY crypto/ /root/Desktop/challenge/crypto/

# HOME=/root by default in this base image; the desktop session runs as root
# unless VNC_USER is overridden at `docker run` time.
