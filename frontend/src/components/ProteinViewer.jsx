import { useEffect, useRef } from "react";
import { fetchResultText } from "../lib/api";
import "3dmol";

export default function ProteinViewer({ pdbUrl }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!pdbUrl || !ref.current) return;
    let disposed = false;
    async function render() {
      const text = await fetchResultText(pdbUrl);
      if (disposed) return;
      ref.current.innerHTML = "";
      const viewer = window.$3Dmol.createViewer(ref.current, { backgroundColor: "white" });
      const format = pdbUrl.endsWith(".cif") ? "cif" : "pdb";
      viewer.addModel(text, format);
      viewer.setStyle({}, { cartoon: { colorscheme: { prop: "b", gradient: "roygb", min: 50, max: 90 } } });
      viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.08, color: "white" });
      viewer.zoomTo();
      viewer.render();
    }
    render();
    return () => {
      disposed = true;
    };
  }, [pdbUrl]);

  return <div className="viewer" ref={ref} />;
}
