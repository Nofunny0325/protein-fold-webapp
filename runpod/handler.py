import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import runpod


AA = set("ACDEFGHIKLMNPQRSTVWYBXZJUO")
FASTA_HEADER = re.compile(r"^>.*$", re.MULTILINE)
MAX_SEQUENCE_LENGTH = int(os.getenv("MAX_SEQUENCE_LENGTH", "800"))
COLABFOLD_BIN = os.getenv("COLABFOLD_BIN", "colabfold_batch")
WORK_ROOT = Path(os.getenv("WORK_ROOT", "/tmp/protein-fold-jobs"))


def normalize_sequence(raw):
    return FASTA_HEADER.sub("", raw or "").replace(" ", "").replace("\n", "").replace("\r", "").upper()


def validate_sequence(sequence):
    if not sequence:
        raise ValueError("Sequence is empty.")
    invalid = sorted(set(sequence) - AA - {":"})
    if invalid:
        raise ValueError(f"Invalid amino-acid symbols: {''.join(invalid)}")
    if any(not chain for chain in sequence.split(":")):
        raise ValueError("Complex sequences must use non-empty chains separated by ':'.")
    if len(sequence) > MAX_SEQUENCE_LENGTH:
        raise ValueError(f"Sequence exceeds serverless limit of {MAX_SEQUENCE_LENGTH} residues.")


def to_fasta(name, sequence):
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", name or "query")
    lines = [sequence[i : i + 80] for i in range(0, len(sequence), 80)]
    return f">{safe_name}\n" + "\n".join(lines) + "\n"


def run_colabfold(job_id, name, sequence):
    job_dir = WORK_ROOT / job_id
    input_path = job_dir / "input.fasta"
    output_dir = job_dir / "colabfold"
    shutil.rmtree(job_dir, ignore_errors=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    input_path.write_text(to_fasta(name, sequence), encoding="utf-8")

    cmd = [
        COLABFOLD_BIN,
        str(input_path),
        str(output_dir),
        "--num-recycle",
        os.getenv("COLABFOLD_NUM_RECYCLE", "3"),
        "--model-type",
        os.getenv("COLABFOLD_MODEL_TYPE", "auto"),
    ]
    if os.getenv("COLABFOLD_AMBER", "0") == "1":
        cmd.append("--amber")

    proc = subprocess.run(cmd, text=True, capture_output=True, timeout=int(os.getenv("PREDICT_TIMEOUT_SECONDS", "7200")))
    if proc.returncode != 0:
        stderr = proc.stderr[-4000:]
        if "out of memory" in stderr.lower() or "cuda_error_out_of_memory" in stderr.lower():
            raise RuntimeError("GPU_OOM: reduce sequence length or use a larger RunPod GPU.")
        raise RuntimeError(stderr or f"ColabFold failed with exit code {proc.returncode}.")

    pdbs = sorted(output_dir.glob("*rank_001*.pdb")) or sorted(output_dir.glob("*.pdb"))
    jsons = sorted(output_dir.glob("*rank_001*.json")) or sorted(output_dir.glob("*.json"))
    if not pdbs:
        raise RuntimeError("ColabFold finished but no PDB was produced.")

    metrics = {"engine": "runpod-colabfold", "mean_plddt": None}
    if jsons:
        try:
            metrics.update(json.loads(jsons[0].read_text(encoding="utf-8")))
        except Exception:
            metrics["raw_metrics_file"] = jsons[0].name

    return {
        "pdb": pdbs[0].read_text(encoding="utf-8"),
        "metrics": metrics,
        "model_filename": "model.pdb",
    }


def handler(job):
    payload = job.get("input") or {}
    sequence = normalize_sequence(payload.get("sequence", ""))
    validate_sequence(sequence)
    name = payload.get("name") or "query"
    return run_colabfold(job["id"], name, sequence)


runpod.serverless.start({"handler": handler})

