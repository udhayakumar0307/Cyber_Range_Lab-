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
    openssl \
    xxd \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash student \
    && echo "student:student" | chpasswd \
    && usermod -aG sudo student

RUN echo "student ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/student \
    && chmod 0440 /etc/sudoers.d/student

USER student
WORKDIR /home/student

CMD ["/bin/bash"]
