import React from "react";

export default function JobStatus({ status }) {
  if (!status) return null;
  return (
    <section className="panel status">
      <div className="row">
        <strong>{status.stage}</strong>
        <span>{status.progress}%</span>
      </div>
      <progress value={status.progress} max="100" />
      {status.message && <pre className="error">{status.message}</pre>}
    </section>
  );
}
