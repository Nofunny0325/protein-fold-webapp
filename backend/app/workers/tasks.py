from celery import states
from backend.app.celery_app import celery_app
from backend.app.config import get_settings
from backend.app.services.engines import PredictionError, run_alphafold3, run_colabfold, run_mock
from backend.app.services.result_store import ResultStore


@celery_app.task(bind=True, name="predict_structure")
def predict_structure(self, job_id: str, name: str, sequence: str) -> dict:
    settings = get_settings()
    store = ResultStore(settings.results_dir)
    job_dir = store.job_dir(job_id)

    try:
        self.update_state(state="PROGRESS", meta={"stage": "QUEUED", "progress": 5})
        self.update_state(state="PROGRESS", meta={"stage": "MSA_SEARCH", "progress": 25})

        if settings.predict_engine == "colabfold":
            model, metrics = run_colabfold(job_dir, name, sequence, settings.colabfold_bin)
        elif settings.predict_engine == "alphafold3":
            model, metrics = run_alphafold3(job_dir, name, sequence, settings.alphafold3_image, settings.af3_model_dir, settings.af3_db_dir)
        else:
            self.update_state(state="PROGRESS", meta={"stage": "STRUCTURE_MODELING", "progress": 65})
            model, metrics = run_mock(job_dir, name, sequence)

        return {"stage": "COMPLETED", "progress": 100, "model": model.name, "metrics": metrics.name}
    except PredictionError as exc:
        self.update_state(state=states.FAILURE, meta={"stage": "FAILED", "progress": 100, "message": str(exc)})
        raise

