import { useState } from "react";

const VALID_AA = /^[ACDEFGHIKLMNPQRSTVWYBXZJUO]+$/i;

export default function SequenceForm({ onSubmit, busy }) {
  const [name, setName] = useState("query_protein");
  const [sequence, setSequence] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const seqOnly = sequence.replace(/^>.*$/gm, "").replace(/\s/g, "");
    if (seqOnly.length < 10) return setError("Sequence must contain at least 10 residues.");
    if (!VALID_AA.test(seqOnly.replace(/:/g, ""))) return setError("Invalid amino-acid symbol detected.");
    setError("");
    onSubmit({ name, sequence, mode: sequence.includes(":") ? "complex" : "monomer" });
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <label>Protein name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      <label>Amino-acid sequence or FASTA</label>
      <textarea value={sequence} onChange={(e) => setSequence(e.target.value)} disabled={busy} spellCheck="false" />
      {error && <div className="error">{error}</div>}
      <button disabled={busy}>{busy ? "Queued" : "Predict structure"}</button>
    </form>
  );
}
