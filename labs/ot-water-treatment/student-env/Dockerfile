FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    nmap \
    netcat-traditional \
    curl \
    wget \
    python3 \
    python3-pip \
    iputils-ping \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pymodbus requests --break-system-packages

# Student helper scripts
COPY tools/ /opt/tools/
RUN chmod +x /opt/tools/scripts/*.py 2>/dev/null || true

# Shell customization
RUN echo 'export PS1="\[\033[01;32m\][AquaShield]\[\033[00m\] \w\$ "' >> /root/.bashrc
RUN echo 'echo ""' >> /root/.bashrc
RUN echo 'echo "+========================================+"' >> /root/.bashrc
RUN echo 'echo "|   AquaShield OT Security Workstation   |"' >> /root/.bashrc
RUN echo 'echo "|   Target PLC: 172.28.0.10              |"' >> /root/.bashrc
RUN echo 'echo "|   Scoring:    http://172.28.0.99:5000  |"' >> /root/.bashrc
RUN echo 'echo "+========================================+"' >> /root/.bashrc
RUN echo 'echo ""' >> /root/.bashrc
RUN echo 'alias target="echo 172.28.0.10"' >> /root/.bashrc
RUN echo 'alias score="curl -s http://172.28.0.99:5000/api/leaderboard | python3 -m json.tool"' >> /root/.bashrc

CMD ["/bin/bash"]
