import React, { useEffect, useState } from "react";
import SequenceForm from "./components/SequenceForm.jsx";
import JobStatus from "./components/JobStatus.jsx";
import ProteinViewer from "./components/ProteinViewer.jsx";
import ConfidencePanel from "./components/ConfidencePanel.jsx";
import BackendSettings from "./components/BackendSettings.jsx";
import { fetchStatus, getInitialApiBase, submitPrediction } from "./lib/api.js";

export default function App() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [apiBase, setApiBase] = useState(getInitialApiBase);
  const busy = status && !["SUCCESS", "FAILURE"].includes(status.state);

  async function submit(payload) {
    setError("");
    setStatus(null);
    const res = await submitPrediction(apiBase, payload).catch((err) => {
      setError(err.message);
      return null;
    });
    if (res) setJobId(res.job_id);
  }

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      const next = await fetchStatus(apiBase, jobId).catch((err) => ({ stage: "ERROR", progress: 100, message: err.message }));
      setStatus(next);
      if (["SUCCESS", "FAILURE"].includes(next.state)) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [apiBase, jobId]);

  return (
    <main>
      <section className="workspace">
        <div className="left">
          <BackendSettings apiBase={apiBase} onChange={setApiBase} busy={busy} />
          <SequenceForm onSubmit={submit} busy={busy || !apiBase} />
          {error && <div className="panel error">{error}</div>}
          <JobStatus status={status} />
          <ConfidencePanel apiBase={apiBase} metricsUrl={status?.metrics_url} pdbUrl={status?.pdb_url} />
        </div>
        <div className="right">
          {status?.pdb_url ? <ProteinViewer apiBase={apiBase} pdbUrl={status.pdb_url} /> : <div className="empty">No structure loaded</div>}
        </div>
      </section>
    </main>
  );
}
