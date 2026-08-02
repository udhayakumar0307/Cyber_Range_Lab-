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
    
    # Mark as initialized
    touch /opt/validation/.passwords_initialized
    echo "=== Unique passwords initialized successfully ==="
fi

# Run the original command
exec "$@"
