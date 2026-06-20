from celery import Celery
from .config import get_settings

settings = get_settings()

celery_app = Celery(
    "protein_fold",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["backend.app.workers.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    result_expires=60 * 60 * 24,
)

