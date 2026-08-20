FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    nmap \
    netcat-traditional \
    curl \
    wget \
    ftp \
    openssh-client \
    openssh-server \
    default-mysql-client \
    python3 \
    python3-pip \
    iputils-ping \
    net-tools \
    dnsutils \
    whois \
    nikto \
    dirb \
    sudo \
    libcap2-bin \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/run/sshd && \
    useradd -m -s /bin/bash student && \
    echo 'student:student' | chpasswd && \
    echo 'root:root' | chpasswd && \
    echo 'student ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && \
    setcap cap_net_raw,cap_net_admin,cap_net_bind_service+eip /usr/bin/nmap || true && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin yes/PermitRootLogin yes/' /etc/ssh/sshd_config

RUN pip3 install requests python-nmap --break-system-packages

# ── Student helper scripts ────────────────────────────────
COPY tools/ /opt/tools/
RUN chmod +x /opt/tools/*.py /opt/tools/*.sh 2>/dev/null || true

# ── Shell customization ───────────────────────────────────
RUN echo 'export PS1="\[\033[01;32m\][SecureGuard]\[\033[00m\] \w\$ "' >> /root/.bashrc
RUN echo 'export PS1="\[\033[01;32m\][SecureGuard]\[\033[00m\] \w\$ "' >> /home/student/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'echo "╔══════════════════════════════════════╗"'             >> /root/.bashrc
RUN echo 'echo "║   SecureGuard Red Team Workstation   ║"'             >> /root/.bashrc
RUN echo 'echo "║   Target: 10.10.0.10                 ║"'             >> /root/.bashrc
RUN echo 'echo "║   Scoring: http://10.10.0.99:5000    ║"'             >> /root/.bashrc
RUN echo 'echo "╚══════════════════════════════════════╝"'             >> /root/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'route add -net 10.10.0.0 netmask 255.255.0.0 dev eth0 2>/dev/null || true' >> /root/.bashrc
RUN echo 'route add -net 10.10.0.0 netmask 255.255.0.0 dev eth0 2>/dev/null || true' >> /home/student/.bashrc

WORKDIR /root
EXPOSE 22

CMD ["bash", "-c", "route add -net 10.10.0.0 netmask 255.255.0.0 dev eth0 2>/dev/null || true; exec /usr/sbin/sshd -D"]
