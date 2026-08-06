FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    openssh-server \
    vsftpd \
    apache2 \
    mariadb-server \
    python3 \
    python3-pip \
    netcat-openbsd \
    curl \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y python3-flask && rm -rf /var/lib/apt/lists/*

# ── SSH Setup ─────────────────────────────────────────────
RUN mkdir -p /var/run/sshd
RUN echo 'root:techcorp2024' | chpasswd

# Create system users for lab
RUN useradd -m -s /bin/bash techcorp && echo 'techcorp:Password123' | chpasswd

# FIX: Modify the pre-existing system 'backup' user instead of creating a new one
RUN mkdir -p /home/backup && \
    usermod -d /home/backup -s /bin/bash backup && \
    chown -R backup:backup /home/backup && \
    echo 'backup:backup123' | chpasswd

# Keep tcbackup for backward compatibility
RUN useradd -m -s /bin/bash tcbackup && echo 'tcbackup:backup123' | chpasswd

# Create sysadmin user if needed
RUN useradd -m -s /bin/bash sysadmin && echo 'sysadmin:$up3rS3cr3t\!' | chpasswd

# ── SSH Configuration ─────────────────────────────────────
# Copy custom SSH config
COPY configs/sshd_config /etc/ssh/sshd_config

# Ensure password authentication is enabled in SSH
RUN sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/^PubkeyAuthentication no/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Create SSH directories for backup user
RUN mkdir -p /home/backup/.ssh && chmod 700 /home/backup/.ssh
RUN chown -R backup:backup /home/backup/.ssh

# ── FTP Setup ─────────────────────────────────────────────
COPY configs/vsftpd.conf /etc/vsftpd.conf
RUN mkdir -p /var/ftp/pub && chmod 755 /var/ftp/pub

# ── Apache / Web Setup ────────────────────────────────────
COPY configs/apache.conf /etc/apache2/sites-available/000-default.conf
COPY configs/webroot/ /var/www/html/
RUN a2enmod rewrite

# ── MySQL Setup ───────────────────────────────────────────
COPY configs/init.sql /docker-entrypoint-initdb.d/init.sql

# ── Hidden Services (ports 8888, 9000) ────────────────────
COPY services/ /opt/services/
RUN chmod +x /opt/services/*.py

# ── Flag Generator & Entrypoint ───────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 21 22 80 3306 8888 9000

ENTRYPOINT ["/entrypoint.sh"]