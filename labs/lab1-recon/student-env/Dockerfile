FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    nmap \
    netcat-traditional \
    curl \
    wget \
    ftp \
    openssh-client \
    default-mysql-client \
    python3 \
    python3-pip \
    iputils-ping \
    net-tools \
    dnsutils \
    whois \
    nikto \
    dirb \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install requests python-nmap --break-system-packages

# ── Student helper scripts ────────────────────────────────
COPY tools/ /opt/tools/
RUN chmod +x /opt/tools/*.py /opt/tools/*.sh 2>/dev/null || true

# ── Shell customization ───────────────────────────────────
RUN echo 'export PS1="\[\033[01;32m\][SecureGuard]\[\033[00m\] \w\$ "' >> /root/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'echo "╔══════════════════════════════════════╗"'             >> /root/.bashrc
RUN echo 'echo "║   SecureGuard Red Team Workstation   ║"'             >> /root/.bashrc
RUN echo 'echo "║   Target: 10.10.0.10                 ║"'             >> /root/.bashrc
RUN echo 'echo "║   Scoring: http://10.10.0.99:5000    ║"'             >> /root/.bashrc
RUN echo 'echo "╚══════════════════════════════════════╝"'             >> /root/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'alias target="echo 10.10.0.10"'                              >> /root/.bashrc
RUN echo 'alias score="curl -s http://10.10.0.99:5000/status | python3 -m json.tool"' >> /root/.bashrc
RUN echo 'alias modules="curl -s http://10.10.0.99:5000/status"'       >> /root/.bashrc

CMD ["/bin/bash"]
