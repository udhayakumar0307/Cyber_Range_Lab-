function normalizeHeaders(headers = {}) {
  return {
    "Content-Type": "application/json",
    ...headers
  };
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: normalizeHeaders(options.headers)
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `HTTP error! status: ${response.status}`);
  }

  return payload;
}
