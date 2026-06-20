import React, { useEffect, useRef, useState } from "react";
import { fetchResultText } from "../lib/api";

const MOLSTAR_URL = "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js";

function load3Dmol() {
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${MOLSTAR_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.$3Dmol), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = MOLSTAR_URL;
    script.async = true;
    script.onload = () => (window.$3Dmol ? resolve(window.$3Dmol) : reject(new Error("3Dmol did not initialize.")));
    script.onerror = () => reject(new Error("Failed to load 3Dmol viewer script."));
    document.head.appendChild(script);
  });
}

export default function ProteinViewer({ pdbUrl }) {
  const ref = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pdbUrl || !ref.current) return;
    let disposed = false;
    async function render() {
      try {
        setError("");
        const [$3Dmol, text] = await Promise.all([load3Dmol(), fetchResultText(pdbUrl)]);
        if (disposed) return;
        ref.current.innerHTML = "";
        const viewer = $3Dmol.createViewer(ref.current, { backgroundColor: "white" });
        const format = pdbUrl.endsWith(".cif") ? "cif" : "pdb";
        viewer.addModel(text, format);
        viewer.setStyle({}, { cartoon: { colorscheme: { prop: "b", gradient: "roygb", min: 50, max: 90 } } });
        viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.08, color: "white" });
        viewer.zoomTo();
        viewer.render();
      } catch (err) {
        if (!disposed) setError(err.message || "Viewer failed to render.");
      }
    }
    render();
    return () => {
      disposed = true;
    };
  }, [pdbUrl]);

  return (
    <div className="viewerShell">
      <div className="viewer" ref={ref} />
      {error && <div className="viewerError">{error}</div>}
    </div>
  );
}
