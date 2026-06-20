import json
import shutil
import subprocess
from pathlib import Path
from .sequence import to_fasta


class PredictionError(RuntimeError):
    pass


def _run(cmd: list[str], cwd: Path | None = None, timeout: int = 60 * 60 * 8) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, timeout=timeout, check=False)
    if proc.returncode != 0:
        stderr = proc.stderr[-4000:]
        if "out of memory" in stderr.lower() or "cuda_error_out_of_memory" in stderr.lower():
            raise PredictionError("GPU_OOM: reduce sequence length, use smaller recycle/model count, or move job to larger GPU.")
        raise PredictionError(stderr or f"Prediction command failed with exit code {proc.returncode}.")
    return proc


def run_mock(job_dir: Path, name: str, sequence: str) -> tuple[Path, Path]:
    pdb = job_dir / "model.pdb"
    metrics = job_dir / "metrics.json"
    residues = min(len(sequence), 60)
    atoms = []
    for i in range(1, residues + 1):
        x = i * 1.45
        y = ((i % 7) - 3) * 0.7
        z = ((i % 5) - 2) * 0.5
        plddt = 55 + (i % 40)
        atoms.append(
            f"ATOM  {i:5d}  CA  ALA A{i:4d}    {x:8.3f}{y:8.3f}{z:8.3f}  1.00{plddt:6.2f}           C"
        )
    pdb.write_text("\n".join(atoms) + "\nEND\n", encoding="utf-8")
    metrics.write_text(json.dumps({"mean_plddt": 74.2, "pae_png": None, "engine": "mock"}, indent=2), encoding="utf-8")
    return pdb, metrics


def run_colabfold(job_dir: Path, name: str, sequence: str, colabfold_bin: str) -> tuple[Path, Path]:
    fasta = job_dir / "input.fasta"
    fasta.write_text(to_fasta(name, sequence), encoding="utf-8")
    out_dir = job_dir / "colabfold"
    out_dir.mkdir(exist_ok=True)
    _run([colabfold_bin, str(fasta), str(out_dir), "--num-recycle", "3", "--amber", "--templates"], timeout=60 * 60 * 12)
    pdbs = sorted(out_dir.glob("*rank_001*.pdb")) or sorted(out_dir.glob("*.pdb"))
    jsons = sorted(out_dir.glob("*rank_001*.json")) or sorted(out_dir.glob("*.json"))
    if not pdbs:
        raise PredictionError("ColabFold finished but no PDB was produced.")
    model = job_dir / "model.pdb"
    shutil.copyfile(pdbs[0], model)
    metrics = job_dir / "metrics.json"
    if jsons:
        shutil.copyfile(jsons[0], metrics)
    else:
        metrics.write_text(json.dumps({"engine": "colabfold"}), encoding="utf-8")
    return model, metrics


def run_alphafold3(job_dir: Path, name: str, sequence: str, image: str, model_dir: Path, db_dir: Path) -> tuple[Path, Path]:
    af_input = job_dir / "af_input"
    af_output = job_dir / "af_output"
    af_input.mkdir(exist_ok=True)
    af_output.mkdir(exist_ok=True)
    payload = {
        "name": name,
        "sequences": [{"protein": {"id": ["A"], "sequence": sequence}}],
        "modelSeeds": [1],
        "dialect": "alphafold3",
        "version": 1,
    }
    (af_input / "fold_input.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    _run([
        "docker", "run", "--rm", "--gpus", "all",
        "--volume", f"{af_input}:/root/af_input",
        "--volume", f"{af_output}:/root/af_output",
        "--volume", f"{model_dir}:/root/models:ro",
        "--volume", f"{db_dir}:/root/public_databases:ro",
        image, "python", "run_alphafold.py",
        "--json_path=/root/af_input/fold_input.json",
        "--model_dir=/root/models",
        "--output_dir=/root/af_output",
    ], timeout=60 * 60 * 24)
    models = sorted(af_output.rglob("*.cif")) + sorted(af_output.rglob("*.pdb"))
    if not models:
        raise PredictionError("AlphaFold3 finished but no model file was produced.")
    model = job_dir / ("model.cif" if models[0].suffix == ".cif" else "model.pdb")
    shutil.copyfile(models[0], model)
    metrics = job_dir / "metrics.json"
    summary = sorted(af_output.rglob("*summary*.json"))
    shutil.copyfile(summary[0], metrics) if summary else metrics.write_text(json.dumps({"engine": "alphafold3"}), encoding="utf-8")
    return model, metrics

