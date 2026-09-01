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
    openssh-server \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/run/sshd && \
    useradd -m -s /bin/bash student && \
    echo "student:student" | chpasswd && \
    usermod -aG sudo student && \
    echo "student ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/student && \
    chmod 0440 /etc/sudoers.d/student && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin yes/PermitRootLogin yes/' /etc/ssh/sshd_config

# ---------------------------------------------------------------------------
# Hidden evidence for investigation-style objectives (OverTheWire-style
# discovery). Several level objectives in module_config.json deliberately
# don't state p/q, keys, or expected checksums directly — students must find
# them here, matching how real systems often expose crypto parameters through
# old backups/logs rather than clean docs. Levels 11 and 14 both reuse the
# same leaked primes (61, 53) since they share the same RSA keypair (n=3233).
# ---------------------------------------------------------------------------
RUN mkdir -p /home/student/evidence/archive && \
    { \
      echo "# TechCorp legacy server backup config"; \
      echo "# Migrated from decommissioned auth-01 host"; \
      echo "service=rsa-keygen-legacy"; \
      echo "legacy_prime_a=61"; \
      echo "status=archived"; \
    } > /home/student/evidence/backup.conf && \
    { \
      echo "2026-08-20 03:14:02 INFO  key rotation job started"; \
      echo "2026-08-20 03:14:02 DEBUG loading legacy prime set"; \
      echo "2026-08-20 03:14:02 DEBUG legacy_prime_b=53"; \
      echo "2026-08-20 03:14:03 INFO  key rotation job completed"; \
    } > /home/student/evidence/archive/archive.log && \
    chown -R student:student /home/student/evidence

# --- Level 21 evidence: a real self-signed certificate to inspect -----------
RUN openssl req -x509 -newkey rsa:2048 -nodes -keyout /home/student/evidence/server.key \
      -out /home/student/evidence/certificate.pem -days 365 \
      -subj "/CN=internal-api.techcorp.local/O=TechCorp/C=US" \
      -addext "subjectAltName=DNS:internal-api.techcorp.local" 2>/dev/null && \
    chown -R student:student /home/student/evidence

# --- Level 24 evidence: unlabeled single-byte-XOR ciphertext ----------------
RUN echo "7662737e631a6365767e7b1a747b7276791a00070305" | xxd -r -p > /home/student/evidence/ciphertext.bin && \
    chown student:student /home/student/evidence/ciphertext.bin

# --- Level 25 evidence: the full final-incident bundle -----------------------
RUN mkdir -p /home/student/evidence/crypto-incident/evidence && \
    { \
      echo "TechCorp SOC — Incident #TC-2026-0824"; \
      echo "======================================"; \
      echo "An encrypted message was pulled from an unverified inbound connection."; \
      echo "Files in this bundle:"; \
      echo "  encrypted_message.bin  - the raw captured payload (hex-dumpable)"; \
      echo "  server_config.txt      - config pulled from the sending host"; \
      echo "  hash.txt                - claimed SHA-256 of the underlying record"; \
      echo "  signature.sig           - claimed RSA signature over the record's digest"; \
      echo "  public_key.pem          - public key the signature claims to verify against"; \
      echo "  exchange.log             - connection log from the receiving proxy"; \
      echo "Work the chain: decode -> verify integrity -> verify authenticity -> report the record."; \
    } > /home/student/evidence/crypto-incident/README.txt && \
    echo "797f1f6e797f786c7e467b5e7f417c7e7e1a527d787f7b5e657e4150677b1717" | xxd -r -p > /home/student/evidence/crypto-incident/encrypted_message.bin && \
    { \
      echo "# relay-04 sending-host config snapshot"; \
      echo "hostname=relay-04.external-partner.net"; \
      echo "protocol=tcp"; \
      echo "compression=none"; \
      echo "xor_key=0x2a"; \
      echo "retry_count=3"; \
      echo "timeout_ms=4000"; \
    } > /home/student/evidence/crypto-incident/server_config.txt && \
    echo "48b66730ea5bc6051dab4dfebb94273cde49fa7a1c44c241af425436520cc6f7" > /home/student/evidence/crypto-incident/hash.txt && \
    echo "1705" > /home/student/evidence/crypto-incident/signature.sig && \
    { \
      echo "-----BEGIN PUBLIC KEY (TRAINING STAND-IN) -----"; \
      echo "n=3233"; \
      echo "e=17"; \
      echo "-----END PUBLIC KEY (TRAINING STAND-IN)-----"; \
    } > /home/student/evidence/crypto-incident/public_key.pem && \
    { \
      echo "2026-08-24 02:11:03 conn accepted from relay-04.external-partner.net:51422"; \
      echo "2026-08-24 02:11:03 tls: NONE (plaintext relay, legacy partner link)"; \
      echo "2026-08-24 02:11:04 payload received: 33 bytes"; \
      echo "2026-08-24 02:11:04 payload queued for SOC review"; \
    } > /home/student/evidence/crypto-incident/exchange.log && \
    chown -R student:student /home/student/evidence/crypto-incident

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
