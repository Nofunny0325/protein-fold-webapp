const COMPILED_API_BASE = import.meta.env.VITE_API_BASE || "";

export function normalizeApiBase(value) {
  return value.trim().replace(/\/+$/, "");
}

export function getInitialApiBase() {
  return normalizeApiBase(localStorage.getItem("protein-fold-api-base") || COMPILED_API_BASE);
}

export function saveApiBase(apiBase) {
  localStorage.setItem("protein-fold-api-base", normalizeApiBase(apiBase));
}

function requireApiBase(apiBase) {
  const normalized = normalizeApiBase(apiBase || "");
  if (!normalized) {
    throw new Error("Real prediction requires a running FastAPI/ColabFold backend URL.");
  }
  return normalized;
}

export async function submitPrediction(apiBase, payload) {
  const base = requireApiBase(apiBase);
  const res = await fetch(`${base}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Prediction request failed");
  return res.json();
}

export async function fetchStatus(apiBase, jobId) {
  const base = requireApiBase(apiBase);
  const res = await fetch(`${base}/status/${jobId}`);
  if (!res.ok) throw new Error("Could not fetch job status");
  return res.json();
}

export function absoluteUrl(apiBase, path) {
  const base = requireApiBase(apiBase);
  return path?.startsWith("http") ? path : `${base}${path}`;
}

export async function fetchResultText(apiBase, path) {
  return fetch(absoluteUrl(apiBase, path)).then((r) => r.text());
}

export async function fetchResultJson(apiBase, path) {
  return fetch(absoluteUrl(apiBase, path)).then((r) => r.json());
}
