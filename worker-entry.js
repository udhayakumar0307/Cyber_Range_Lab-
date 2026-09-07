export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Web-app lab roots need their trailing slash (nginx matches the proxy
    // `location` by the `/compliance-lab/` prefix). Normalise the bare path so
    // an older frontend build that drops the slash still resolves.
    if (url.pathname === '/compliance-lab') {
      return Response.redirect(new URL('/compliance-lab/', url).toString(), 308);
    }

    // Forward /api/, /health, and self-contained web-app labs (each served by
    // its own container behind nginx on the EC2) straight to the backend.
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/health') ||
      url.pathname.startsWith('/compliance-lab/')
    ) {
      const backendUrl = new URL(request.url);
      backendUrl.hostname = 'api-academy.deeptrustxai.com';
      backendUrl.protocol = 'https:';

      const newRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      });

      return fetch(newRequest);
    }

    // Fallback: serve static frontend files
    return env.ASSETS.fetch(request);
  },
};
