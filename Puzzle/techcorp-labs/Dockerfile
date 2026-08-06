FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Re-enable man pages and documentation (unminimize preparation)
RUN rm -f /etc/dpkg/dpkg.cfg.d/excludes && \
    rm -f /usr/bin/man && \
    dpkg-divert --rename --remove /usr/bin/man || true

# Install all necessary tools for the lab
RUN apt-get update && apt-get install -y \
    openssh-server \
    openssh-client \
    systemd \
    systemd-sysv \
    sudo \
    vim \
    nano \
    curl \
    wget \
    git \
    net-tools \
    iputils-ping \
    iproute2 \
    iptables \
    netcat-openbsd \
    traceroute \
    dnsutils \
    lvm2 \
    fdisk \
    parted \
    e2fsprogs \
    dosfstools \
    tar \
    gzip \
    bzip2 \
    xz-utils \
    acl \
    quota \
    quotatool \
    htop \
    iotop \
    grep \
    sed \
    bc \
    man \
    manpages \
    apache2 \
    nginx \
    postgresql-client \
    mysql-client \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Flask for demo app (Level 20)
RUN pip3 install flask

# Create SSH directory
RUN mkdir -p /run/sshd
RUN mkdir -p /var/log/syslog

# SSH configuration: allow password auth and custom port
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    echo "Port 2222" >> /etc/ssh/sshd_config && \
    echo "PermitEmptyPasswords no" >> /etc/ssh/sshd_config

# Create necessary directories for labs
RUN mkdir -p /opt/labs \
    && mkdir -p /opt/validation \
    && mkdir -p /opt/scripts \
    && mkdir -p /opt/techcorp \
    && mkdir -p /mnt/data \
    && mkdir -p /mnt/backup

# Create groups that will be used in labs
RUN groupadd -f admin \
    && groupadd -f techcorp \
    && groupadd -f developers \
    && groupadd -f payments

# Enable systemd
RUN systemctl set-default multi-user.target && \
    systemctl mask dev-mqueue.mount dev-hugepages.mount \
    sys-kernel-debug.mount sys-kernel-security.mount

# Copy and execute provisioning script during build
COPY provision.sh /opt/scripts/provision.sh
RUN chmod +x /opt/scripts/provision.sh && /opt/scripts/provision.sh

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose SSH port
EXPOSE 2222

RUN echo "level0:starthere" | chpasswd

# Set entrypoint and start SSH daemon
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]