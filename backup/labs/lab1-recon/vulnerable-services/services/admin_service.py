#!/usr/bin/env python3
"""
TechCorp Admin Console - Port 8888 (Module 5)
Hidden service requiring credentials discovered through Modules 1-4
"""

import sys
import socket
import threading

FLAG_MOD5 = sys.argv[1] if len(sys.argv) > 1 else "FLAG{techcorp_lab1_mod5_default}"

BANNER = f"""
╔══════════════════════════════════════════════════════════╗
║          TechCorp Industries - Admin Console             ║
║          RESTRICTED ACCESS - Authorized Only             ║
║          Version: AdminConsole/1.3.2                     ║
╚══════════════════════════════════════════════════════════╝

Commands:
  HELP     - Show available commands
  STATUS   - System status
  FLAG     - Retrieve admin flag (requires auth)
  QUIT     - Disconnect

> """

AUTH_CHALLENGE = """
Authentication required.
Enter admin password: """

# Password is discoverable from backup user's files in Module 4
# Specifically: in /home/backup/.ssh/id_rsa.notes
# This mimics real-world scenarios where config files contain credentials
ADMIN_PASSWORD = "techcorp_admin_2024"

def handle_client(conn, addr):
    """Handle individual client connections"""
    print(f"[AdminConsole] Connection from {addr}")
    try:
        conn.sendall(BANNER.encode())
        authenticated = False

        while True:
            data = conn.recv(1024).decode(errors="ignore").strip()
            if not data:
                break

            cmd = data.upper()

            if cmd == "HELP":
                conn.sendall(b"Commands: HELP, STATUS, FLAG, AUTH, QUIT\n> ")

            elif cmd == "STATUS":
                conn.sendall(
                    b"System Status: OPERATIONAL\n"
                    b"Services: FTP[UP] SSH[UP] HTTP[UP] MySQL[UP] API[UP]\n"
                    b"Uptime: 47 days\n"
                    b"Last backup: 2026-06-27 12:30:00 UTC\n> "
                )

            elif cmd == "AUTH":
                conn.sendall(AUTH_CHALLENGE.encode())
                password = conn.recv(1024).decode(errors="ignore").strip()
                if password == ADMIN_PASSWORD:
                    authenticated = True
                    conn.sendall(b"Authentication successful. Welcome, admin.\n> ")
                else:
                    conn.sendall(b"Invalid password.\n> ")

            elif cmd == "FLAG":
                if authenticated:
                    conn.sendall(
                        f"Admin flag: {FLAG_MOD5}\n"
                        f"\nCongratulations! You've successfully:\n"
                        f"  1. Mapped the network (Module 1)\n"
                        f"  2. Fingerprinted services (Module 2)\n"
                        f"  3. Discovered hidden APIs (Module 3)\n"
                        f"  4. Harvested credentials (Module 4)\n"
                        f"  5. Accessed the admin console (Module 5)\n"
                        f"\nYou've completed a full reconnaissance and penetration test.\n> ".encode()
                    )
                else:
                    conn.sendall(b"Authentication required. Use AUTH command first.\n> ")

            elif cmd == "QUIT":
                conn.sendall(b"Goodbye.\n")
                break

            else:
                conn.sendall(f"Unknown command: {data}\n> ".encode())

    except Exception as e:
        print(f"[AdminConsole] Error: {e}")
    finally:
        conn.close()

def main():
    """Main server loop"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", 8888))
    server.listen(5)
    print(f"[AdminConsole] Listening on port 8888")
    print(f"[AdminConsole] Admin flag loaded: {FLAG_MOD5[:50]}...")

    try:
        while True:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr))
            t.daemon = True
            t.start()
    except KeyboardInterrupt:
        print("\n[AdminConsole] Shutting down...")
    finally:
        server.close()

if __name__ == "__main__":
    main()