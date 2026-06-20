import { useEffect, useState } from "react";
import { absoluteUrl, fetchResultJson } from "../lib/api";

export default function ConfidencePanel({ metricsUrl, pdbUrl }) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!metricsUrl) return;
    fetchResultJson(metricsUrl).then(setMetrics).catch(() => setMetrics(null));
  }, [metricsUrl]);

  if (!metricsUrl && !pdbUrl) return null;
  return (
    <aside className="panel confidence">
      <h2>Confidence</h2>
      <div className="scale">
        <span>Low</span><span>pLDDT B-factor coloring</span><span>High</span>
      </div>
      <div className="bar" />
      {metrics && <pre>{JSON.stringify(metrics, null, 2)}</pre>}
      {pdbUrl && !pdbUrl.startsWith("mock://") && <a href={absoluteUrl(pdbUrl)} download>Download model</a>}
    </aside>
  );
}
