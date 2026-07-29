const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function uploadPcap(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/pcap/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Failed to upload PCAP.");
  return await response.json();
}

export async function getCaptures() {
  const response = await fetch(`${API_BASE}/api/pcap/captures`);

  if (!response.ok) throw new Error("Failed to load captures.");
  return await response.json();
}

export async function getCaptureById(captureId) {
  const response = await fetch(`${API_BASE}/api/pcap/captures/${captureId}`);

  if (!response.ok) throw new Error("Failed to load capture.");
  return await response.json();
}

export async function generatePcap(packets, filename = "simulated_capture.pcap") {
  const response = await fetch(`${API_BASE}/api/pcap/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename, packets }),
  });

  if (!response.ok) throw new Error("Failed to generate PCAP.");
  return await response.json();
}

export function getPcapDownloadUrl(filename) {
  return `${API_BASE}/api/pcap/download/${filename}`;
}
