const API_BASE = import.meta.env.VITE_API_BASE || "";
const USE_STATIC_MOCK = !API_BASE;
const mockJobs = new Map();

function makePdb(sequence) {
  const residues = Math.min(sequence.replace(/:/g, "").length, 90);
  const atoms = [];
  for (let i = 1; i <= residues; i += 1) {
    const x = (i * 1.45).toFixed(3).padStart(8);
    const y = (((i % 7) - 3) * 0.7).toFixed(3).padStart(8);
    const z = (((i % 5) - 2) * 0.5).toFixed(3).padStart(8);
    const b = (55 + (i % 40)).toFixed(2).padStart(6);
    atoms.push(`ATOM  ${String(i).padStart(5)}  CA  ALA A${String(i).padStart(4)}    ${x}${y}${z}  1.00${b}           C`);
  }
  return `${atoms.join("\n")}\nEND\n`;
}

export async function submitPrediction(payload) {
  if (USE_STATIC_MOCK) {
    const jobId = crypto.randomUUID();
    mockJobs.set(jobId, {
      createdAt: Date.now(),
      pdb: makePdb(payload.sequence),
      metrics: { engine: "static-mock", mean_plddt: 74.2, note: "GitHub Pages demo mode. Connect VITE_API_BASE for real FastAPI inference." },
    });
    return { job_id: jobId, status_url: `/status/${jobId}` };
  }

  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Prediction request failed");
  return res.json();
}

export async function fetchStatus(jobId) {
  if (USE_STATIC_MOCK) {
    const job = mockJobs.get(jobId);
    if (!job) return { job_id: jobId, state: "PENDING", stage: "PENDING", progress: 0 };
    const elapsed = Date.now() - job.createdAt;
    if (elapsed < 1000) return { job_id: jobId, state: "PROGRESS", stage: "MSA_SEARCH", progress: 35 };
    if (elapsed < 2000) return { job_id: jobId, state: "PROGRESS", stage: "STRUCTURE_MODELING", progress: 75 };
    return {
      job_id: jobId,
      state: "SUCCESS",
      stage: "COMPLETED",
      progress: 100,
      pdb_url: `mock://${jobId}/model.pdb`,
      metrics_url: `mock://${jobId}/metrics.json`,
    };
  }

  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Could not fetch job status");
  return res.json();
}

export function absoluteUrl(path) {
  return path?.startsWith("http") ? path : `${API_BASE}${path}`;
}

export async function fetchResultText(path) {
  if (path?.startsWith("mock://")) {
    const jobId = path.replace("mock://", "").split("/")[0];
    return mockJobs.get(jobId)?.pdb || "";
  }
  return fetch(absoluteUrl(path)).then((r) => r.text());
}

export async function fetchResultJson(path) {
  if (path?.startsWith("mock://")) {
    const jobId = path.replace("mock://", "").split("/")[0];
    return mockJobs.get(jobId)?.metrics || {};
  }
  return fetch(absoluteUrl(path)).then((r) => r.json());
}
