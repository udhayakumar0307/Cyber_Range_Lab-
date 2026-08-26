FROM quay.io/rockylinux/rockylinux:9

RUN dnf -y install --allowerasing \
      bash coreutils findutils grep gawk sed tar gzip \
      procps-ng shadow-utils util-linux \
      vim-enhanced nano less man-db man-pages \
      sudo python3 curl \
    && dnf clean all \
    && rm -rf /var/cache/dnf

RUN useradd -m -s /bin/bash student \
    && echo 'student ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/student \
    && chmod 0440 /etc/sudoers.d/student \
    && mkdir -p /run/cyberrange /etc/cyberrange \
    && chown student:student /run/cyberrange

COPY bin/submit /usr/local/bin/submit
RUN chmod 0755 /usr/local/bin/submit

USER student
WORKDIR /home/student
CMD ["/bin/bash"]
