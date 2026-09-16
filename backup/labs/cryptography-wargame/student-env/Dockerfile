FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      coreutils xxd openssl sqlite3 netcat-openbsd curl file vim-tiny less \
      binutils bsdmainutils \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pycryptodome PyJWT sympy requests

# web terminal (ttyd static binary, arch-aware)
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      arm64) TA=aarch64 ;; amd64) TA=x86_64 ;; *) TA=x86_64 ;; esac \
 && curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.$TA" \
      -o /usr/local/bin/ttyd \
 && chmod +x /usr/local/bin/ttyd

COPY student-env/motd /etc/motd
COPY student-env/bashrc_extra /root/.bashrc_extra
RUN echo '[ -f /root/.bashrc_extra ] && . /root/.bashrc_extra' >> /root/.bashrc
WORKDIR /levels
EXPOSE 7681
# main process: web terminal serving an interactive login bash.
# (`docker compose exec student-env bash` still works alongside this.)
CMD ["ttyd","-p","7681","-W","-t","fontSize=14","-t","cursorBlink=true","bash","-l"]
