from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "atlas_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.source_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_queue_max_priority=10,
    task_default_priority=5,
    worker_prefetch_multiplier=1,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    broker_transport_options={
        "queue_order_strategy": "priority",
    },
    task_routes={
        "app.workers.source_tasks.process_source_task": {"queue": "sources"},
        "app.workers.source_tasks.index_source_task": {"queue": "sources"},
    },
)
