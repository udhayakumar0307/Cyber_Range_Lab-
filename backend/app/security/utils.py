from fastapi import Request

def get_client_ip(request: Request) -> str:
    """
    Extracts client IP address safely from request headers (handling proxies).
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

def get_user_agent(request: Request) -> str:
    """
    Extracts User-Agent header from request.
    """
    return request.headers.get("User-Agent", "Unknown Browser/Client")
