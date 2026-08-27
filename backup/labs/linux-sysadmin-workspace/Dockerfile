FROM quay.io/rockylinux/rockylinux:9

RUN dnf -y install --allowerasing \
      bash coreutils findutils grep gawk sed tar gzip \
      procps-ng shadow-utils util-linux \
      vim-enhanced nano less man-db man-pages \
      sudo python3 curl openssh-server openssh-clients \
    && dnf clean all \
    && rm -rf /var/cache/dnf

RUN useradd -m -s /bin/bash student \
    && echo 'student ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/student \
    && chmod 0440 /etc/sudoers.d/student \
    && mkdir -p /run/cyberrange /etc/cyberrange /run/sshd \
    && chown student:student /run/cyberrange \
    && printf '%s\n' \
      'PasswordAuthentication yes' \
      'PermitRootLogin no' \
      'AllowUsers student' \
      'X11Forwarding no' \
      'AllowTcpForwarding no' \
      'PermitTunnel no' \
      'GatewayPorts no' \
      >> /etc/ssh/sshd_config

COPY bin/submit /usr/local/bin/submit
COPY bin/workspace-entrypoint /usr/local/bin/workspace-entrypoint
RUN chmod 0755 /usr/local/bin/submit /usr/local/bin/workspace-entrypoint

WORKDIR /home/student
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
