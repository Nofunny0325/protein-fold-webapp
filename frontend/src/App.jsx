import { useEffect, useState } from "react";
import SequenceForm from "./components/SequenceForm.jsx";
import JobStatus from "./components/JobStatus.jsx";
import ProteinViewer from "./components/ProteinViewer.jsx";
import ConfidencePanel from "./components/ConfidencePanel.jsx";
import { fetchStatus, submitPrediction } from "./lib/api.js";

export default function App() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  async function submit(payload) {
    setError("");
    setStatus(null);
    const res = await submitPrediction(payload).catch((err) => {
      setError(err.message);
      return null;
    });
    if (res) setJobId(res.job_id);
  }

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      const next = await fetchStatus(jobId).catch((err) => ({ stage: "ERROR", progress: 100, message: err.message }));
      setStatus(next);
      if (["SUCCESS", "FAILURE"].includes(next.state)) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [jobId]);

  return (
    <main>
      <section className="workspace">
        <div className="left">
          <SequenceForm onSubmit={submit} busy={status && !["SUCCESS", "FAILURE"].includes(status.state)} />
          {error && <div className="panel error">{error}</div>}
          <JobStatus status={status} />
          <ConfidencePanel metricsUrl={status?.metrics_url} pdbUrl={status?.pdb_url} />
        </div>
        <div className="right">
          {status?.pdb_url ? <ProteinViewer pdbUrl={status.pdb_url} /> : <div className="empty">No structure loaded</div>}
        </div>
      </section>
    </main>
  );
}

