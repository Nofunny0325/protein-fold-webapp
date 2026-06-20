from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from .config import get_settings
from .schemas.predict import JobStatus, PredictRequest, PredictResponse
from .services.local_runner import LocalRunner
from .services.result_store import ResultStore
from .services.sequence import validate_protein_sequence

app = FastAPI(title="Async Protein Structure Prediction API")
settings = get_settings()
store = ResultStore(settings.results_dir)
local_runner = LocalRunner(settings) if settings.queue_mode == "local" else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    sequence = validate_protein_sequence(req.sequence, settings.max_sequence_length)
    job_id = str(uuid4())
    if settings.queue_mode == "local":
        local_runner.submit(job_id, req.name, sequence)
    else:
        from .workers.tasks import predict_structure
        predict_structure.apply_async(args=[job_id, req.name, sequence], task_id=job_id)
    return PredictResponse(job_id=job_id, status_url=f"/status/{job_id}")


@app.get("/status/{job_id}", response_model=JobStatus)
def status(job_id: str) -> JobStatus:
    if settings.queue_mode == "local":
        job = local_runner.get(job_id)
        state, stage, progress, message = job.state, job.stage, job.progress, job.message
    else:
        from celery.result import AsyncResult
        from .celery_app import celery_app
        result = AsyncResult(job_id, app=celery_app)
        meta = result.info if isinstance(result.info, dict) else {}
        state = result.state
        if state == "PENDING":
            stage, progress = "PENDING", 0
        elif state == "SUCCESS":
            stage, progress = "COMPLETED", 100
        elif state == "FAILURE":
            stage, progress = meta.get("stage", "FAILED"), 100
        else:
            stage, progress = meta.get("stage", state), int(meta.get("progress", 10))
        message = meta.get("message") if isinstance(meta, dict) else (str(result.info) if result.info else None)

    model = store.find_model(job_id)
    return JobStatus(
        job_id=job_id,
        state=state,
        stage=stage,
        progress=progress,
        message=message,
        pdb_url=f"/results/{job_id}/{model.name}" if model else None,
        metrics_url=f"/results/{job_id}/metrics.json" if (store.job_dir(job_id) / "metrics.json").exists() else None,
    )


@app.get("/results/{job_id}/{filename}")
def result_file(job_id: str, filename: str):
    path = store.job_dir(job_id) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result file not found.")
    return FileResponse(path)
