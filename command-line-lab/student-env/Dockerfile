FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    bash \
    coreutils \
    findutils \
    grep \
    sed \
    gawk \
    procps \
    nano \
    vim \
    less \
    tree \
    python3 \
    python3-pip \
    curl \
    sudo \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# ── Student account (unprivileged, matches beginner-lab intent) ──
RUN useradd -m -s /bin/bash student \
    && echo "student:student" | chpasswd \
    && usermod -aG sudo student

# Module 4 requires `sudo chown ...`. Passwordless sudo for the student
# user avoids leaving students guessing at an undocumented password —
# this is a deliberate, scoped choice for a beginner training lab, not
# a general security posture.
RUN echo "student ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/student \
    && chmod 0440 /etc/sudoers.d/student

# ── Helper tools available on PATH inside the terminal ──
COPY tools/ /opt/tools/
RUN chmod +x /opt/tools/*.py

# ── Session command log (read by progress_service.py from outside) ──
RUN mkdir -p /var/log/session && chown student:student /var/log/session

WORKDIR /home/student

CMD ["/bin/bash"]
