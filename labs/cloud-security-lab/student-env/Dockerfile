FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

# Install utilities, AWS CLI, and jq
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    python3 \
    python3-pip \
    awscli \
    jq \
    iputils-ping \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install boto3 --break-system-packages

# Shell customization
RUN echo 'export PS1="\[\033[01;36m\][SecureGuard-Cloud]\[\033[00m\] \w\$ "' >> /root/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'echo "╔══════════════════════════════════════╗"'             >> /root/.bashrc
RUN echo 'echo "║   SecureGuard Cloud Red Team Work    ║"'             >> /root/.bashrc
RUN echo 'echo "║   Target Cloud API: 10.20.0.10       ║"'             >> /root/.bashrc
RUN echo 'echo "║   Scoring Server: 10.20.0.99:5000    ║"'             >> /root/.bashrc
RUN echo 'echo "╚══════════════════════════════════════╝"'             >> /root/.bashrc
RUN echo 'echo ""'                                                      >> /root/.bashrc
RUN echo 'alias target="echo 10.20.0.10"'                              >> /root/.bashrc
RUN echo 'alias score="curl -s http://10.20.0.99:5000/api/health"'     >> /root/.bashrc

CMD ["/bin/bash"]
