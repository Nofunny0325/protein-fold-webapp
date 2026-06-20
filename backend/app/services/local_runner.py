from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from threading import Lock
from typing import Any
from .engines import PredictionError, run_alphafold3, run_colabfold, run_mock
from .result_store import ResultStore


@dataclass
class LocalJob:
    state: str = "PENDING"
    stage: str = "PENDING"
    progress: int = 0
    message: str | None = None
    result: dict[str, Any] = field(default_factory=dict)


class LocalRunner:
    def __init__(self, settings):
        self.settings = settings
        self.store = ResultStore(settings.results_dir)
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.jobs: dict[str, LocalJob] = {}
        self.lock = Lock()

    def submit(self, job_id: str, name: str, sequence: str) -> None:
        with self.lock:
            self.jobs[job_id] = LocalJob(state="PENDING", stage="QUEUED", progress=5)
        self.executor.submit(self._run, job_id, name, sequence)

    def get(self, job_id: str) -> LocalJob:
        with self.lock:
            return self.jobs.get(job_id, LocalJob())

    def _set(self, job_id: str, **updates) -> None:
        with self.lock:
            job = self.jobs.setdefault(job_id, LocalJob())
            for key, value in updates.items():
                setattr(job, key, value)

    def _run(self, job_id: str, name: str, sequence: str) -> None:
        job_dir = self.store.job_dir(job_id)
        try:
            self._set(job_id, state="PROGRESS", stage="MSA_SEARCH", progress=25)
            if self.settings.predict_engine == "colabfold":
                model, metrics = run_colabfold(job_dir, name, sequence, self.settings.colabfold_bin)
            elif self.settings.predict_engine == "alphafold3":
                model, metrics = run_alphafold3(
                    job_dir,
                    name,
                    sequence,
                    self.settings.alphafold3_image,
                    self.settings.af3_model_dir,
                    self.settings.af3_db_dir,
                )
            else:
                self._set(job_id, state="PROGRESS", stage="STRUCTURE_MODELING", progress=65)
                model, metrics = run_mock(job_dir, name, sequence)
            self._set(
                job_id,
                state="SUCCESS",
                stage="COMPLETED",
                progress=100,
                result={"model": model.name, "metrics": metrics.name},
            )
        except PredictionError as exc:
            self._set(job_id, state="FAILURE", stage="FAILED", progress=100, message=str(exc))
        except Exception as exc:
            self._set(job_id, state="FAILURE", stage="FAILED", progress=100, message=f"Unhandled worker error: {exc}")
