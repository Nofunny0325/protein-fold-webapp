const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function text(payload, contentType = "text/plain", status = 200) {
  return new Response(payload, {
    status,
    headers: {
      "content-type": contentType,
      "access-control-allow-origin": "*",
    },
  });
}

function runpodBase(env) {
  if (!env.RUNPOD_ENDPOINT_ID || !env.RUNPOD_API_KEY) {
    throw new Error("Cloudflare Worker is missing RUNPOD_ENDPOINT_ID or RUNPOD_API_KEY.");
  }
  return `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}`;
}

async function runpodFetch(env, path, init = {}) {
  const response = await fetch(`${runpodBase(env)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = { raw: body };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, payload };
  }
  return { ok: true, status: response.status, payload };
}

function mapRunpodStatus(jobId, payload) {
  const status = payload.status || "UNKNOWN";
  if (status === "COMPLETED") {
    return {
      job_id: jobId,
      state: "SUCCESS",
      stage: "COMPLETED",
      progress: 100,
      pdb_url: `/results/${jobId}/model.pdb`,
      metrics_url: `/results/${jobId}/metrics.json`,
    };
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT") {
    return {
      job_id: jobId,
      state: "FAILURE",
      stage: status,
      progress: 100,
      message: payload.error || payload.output?.error || status,
    };
  }
  return {
    job_id: jobId,
    state: "PROGRESS",
    stage: status === "IN_QUEUE" ? "QUEUED" : "STRUCTURE_MODELING",
    progress: status === "IN_QUEUE" ? 10 : 55,
    message: payload.delayTime ? `Queued for ${Math.round(payload.delayTime / 1000)}s` : null,
  };
}

async function handlePredict(request, env) {
  const body = await request.json();
  const result = await runpodFetch(env, "/run", {
    method: "POST",
    body: JSON.stringify({
      input: {
        name: body.name || "query",
        sequence: body.sequence || "",
      },
      policy: {
        executionTimeout: Number(env.RUNPOD_EXECUTION_TIMEOUT_MS || 7200000),
        ttl: Number(env.RUNPOD_TTL_MS || 10800000),
      },
    }),
  });
  if (!result.ok) return json(result.payload, result.status);
  const jobId = result.payload.id;
  return json({ job_id: jobId, status_url: `/status/${jobId}` });
}

async function handleStatus(jobId, env) {
  const result = await runpodFetch(env, `/status/${jobId}`, { method: "GET" });
  if (!result.ok) return json(result.payload, result.status);
  return json(mapRunpodStatus(jobId, result.payload));
}

async function handleResult(jobId, filename, env) {
  const result = await runpodFetch(env, `/status/${jobId}`, { method: "GET" });
  if (!result.ok) return json(result.payload, result.status);
  if (result.payload.status !== "COMPLETED") {
    return json({ detail: "Result is not ready.", runpod_status: result.payload.status }, 409);
  }
  const output = result.payload.output || {};
  if (filename === "model.pdb") return text(output.pdb || "", "chemical/x-pdb");
  if (filename === "metrics.json") return json(output.metrics || {});
  return json({ detail: "Unknown result file." }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/predict" && request.method === "POST") return handlePredict(request, env);
      const statusMatch = url.pathname.match(/^\/status\/([^/]+)$/);
      if (statusMatch && request.method === "GET") return handleStatus(statusMatch[1], env);
      const resultMatch = url.pathname.match(/^\/results\/([^/]+)\/([^/]+)$/);
      if (resultMatch && request.method === "GET") return handleResult(resultMatch[1], resultMatch[2], env);
      return json({ detail: "Not found." }, 404);
    } catch (error) {
      return json({ detail: error.message || String(error) }, 500);
    }
  },
};

