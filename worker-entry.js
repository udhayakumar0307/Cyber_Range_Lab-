export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward all /api/ and /health requests directly to the EC2 backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health')) {
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
