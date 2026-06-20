import React, { useState } from "react";
import { normalizeApiBase, saveApiBase } from "../lib/api";

export default function BackendSettings({ apiBase, onChange, busy }) {
  const [value, setValue] = useState(apiBase);

  function save() {
    const normalized = normalizeApiBase(value);
    saveApiBase(normalized);
    onChange(normalized);
  }

  return (
    <section className="panel backend">
      <label>Real prediction backend URL</label>
      <div className="backendRow">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://your-gpu-backend.example.com"
          disabled={busy}
        />
        <button type="button" onClick={save} disabled={busy}>Save</button>
      </div>
      {!apiBase && (
        <p className="hint">
          GitHub Pages cannot run AlphaFold. Start the GPU FastAPI backend, paste its HTTPS URL here, then submit a sequence.
        </p>
      )}
    </section>
  );
}
