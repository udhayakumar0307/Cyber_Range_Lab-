#!/bin/bash
set -e

# Path to the initial passwords file
PASSWORD_FILE="/opt/scripts/initial_passwords.txt"
VALIDATION_DIR="/opt/validation"

# Function to generate random password
generate_password() {
    openssl rand -base64 12 | tr -d "=+/" | cut -c1-12
}

# If passwords have not been initialized specifically for this container instance's volume
if [ ! -f /opt/validation/.passwords_initialized ]; then
    echo "=== Initializing unique passwords for this container instance ==="
    
    # Empty the password file
    echo "# Unique Level Passwords for this Lab Instance" > "$PASSWORD_FILE"
    chmod 640 "$PASSWORD_FILE"
    chown root:systemd-journal "$PASSWORD_FILE"
    
    # We keep level0 password as "starthere" so students can log in
    echo "level0: starthere" >> "$PASSWORD_FILE"
    echo "level0:starthere" | chpasswd
    
    # Generate new random passwords for levels 1 through 33
    for i in $(seq 1 33); do
        USERNAME="level${i}"
        PASSWORD=$(generate_password)
        
        # Set user password in the system
        echo "${USERNAME}:${PASSWORD}" | chpasswd
        
        # Store password in secure validation file
        echo "$PASSWORD" > "${VALIDATION_DIR}/${USERNAME}.key"
        chmod 640 "${VALIDATION_DIR}/${USERNAME}.key"
        chown root:systemd-journal "${VALIDATION_DIR}/${USERNAME}.key"
        
        echo "${USERNAME}: ${PASSWORD}" >> "$PASSWORD_FILE"
    done

    # Levels 0-4 contain the next-level password inside challenge artifacts
    # created when the Docker image is built. Because passwords are regenerated
    # per container above, refresh those artifacts as well; otherwise the
    # validators return stale image-build credentials and the WebSocket cannot
    # reconnect as the newly unlocked user.
    LEVEL1_PASS=$(cat "${VALIDATION_DIR}/level1.key")
    LEVEL2_PASS=$(cat "${VALIDATION_DIR}/level2.key")
    LEVEL3_PASS=$(cat "${VALIDATION_DIR}/level3.key")
    LEVEL4_PASS=$(cat "${VALIDATION_DIR}/level4.key")
    LEVEL5_PASS=$(cat "${VALIDATION_DIR}/level5.key")

    echo "level1_password: ${LEVEL1_PASS}" > /opt/labs/level0/deploy.log
    chmod 000 /opt/labs/level0/deploy.log
    chown level0:level0 /opt/labs/level0/deploy.log

    echo "level2_password: ${LEVEL2_PASS}" > /opt/labs/level1/.secret_config
    chmod 644 /opt/labs/level1/.secret_config
    chown level1:level1 /opt/labs/level1/.secret_config

    echo "level3_password: ${LEVEL3_PASS}" > /opt/labs/level2/config.conf
    chmod 640 /opt/labs/level2/config.conf
    chown alice:users /opt/labs/level2/config.conf

    echo "level4_password: ${LEVEL4_PASS}" > /opt/labs/level3/protected_data.txt
    chmod 640 /opt/labs/level3/protected_data.txt
    chown root:protected_data /opt/labs/level3/protected_data.txt

    echo "level5_password: ${LEVEL5_PASS}" > /opt/labs/level4/report.txt
    chmod 600 /opt/labs/level4/report.txt
    chown level4:level4 /opt/labs/level4/report.txt
    
    # Mark as initialized
    touch /opt/validation/.passwords_initialized
    echo "=== Unique passwords initialized successfully ==="
fi

# Run the original command
exec "$@"
