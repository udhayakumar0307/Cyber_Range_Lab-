"""
Enterprise Breach - "Port Scan Secret" challenge.

A bare TCP service with no protocol beyond "connect and read". Discoverable
via an nmap scan of the challenge network; solved with `nc netsvc 7331`.
"""
import socket

FLAG = "flag{n3tw0rk_p0rt_5c4n_f0und_it_5b88}"
BANNER = (
    "Acme Corp internal telemetry relay v0.9\r\n"
    "WARNING: unauthenticated debug endpoint - decommission before launch.\r\n"
    f"{FLAG}\r\n"
)


def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", 7331))
    sock.listen(20)
    print("netsvc listening on 0.0.0.0:7331")
    while True:
        conn, addr = sock.accept()
        try:
            conn.sendall(BANNER.encode())
        finally:
            conn.close()


if __name__ == "__main__":
    main()
