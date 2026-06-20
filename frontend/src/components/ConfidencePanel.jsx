import React, { useEffect, useState } from "react";
import { absoluteUrl, fetchResultJson } from "../lib/api";

export default function ConfidencePanel({ apiBase, metricsUrl, pdbUrl }) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!metricsUrl) return;
    fetchResultJson(apiBase, metricsUrl).then(setMetrics).catch(() => setMetrics(null));
  }, [apiBase, metricsUrl]);

  if (!metricsUrl && !pdbUrl) return null;
  return (
    <aside className="panel confidence">
      <h2>Confidence</h2>
      <div className="scale">
        <span>Low</span><span>pLDDT B-factor coloring</span><span>High</span>
      </div>
      <div className="bar" />
      {metrics && <pre>{JSON.stringify(metrics, null, 2)}</pre>}
      {pdbUrl && <a href={absoluteUrl(apiBase, pdbUrl)} download>Download model</a>}
    </aside>
  );
}
