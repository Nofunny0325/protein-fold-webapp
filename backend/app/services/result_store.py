import json
from pathlib import Path
from typing import Any


class ResultStore:
    def __init__(self, root: Path):
        self.root = root

    def job_dir(self, job_id: str) -> Path:
        path = self.root / job_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def write_json(self, job_id: str, name: str, payload: dict[str, Any]) -> Path:
        path = self.job_dir(job_id) / name
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def read_json(self, job_id: str, name: str) -> dict[str, Any] | None:
        path = self.job_dir(job_id) / name
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def find_model(self, job_id: str) -> Path | None:
        job_path = self.job_dir(job_id)
        preferred = job_path / "model.pdb"
        if preferred.exists():
            return preferred
        candidates = sorted(job_path.glob("*.pdb")) + sorted(job_path.glob("*.cif"))
        return candidates[0] if candidates else None

