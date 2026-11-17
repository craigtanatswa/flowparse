from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .config import Settings
from .extract.ocr import check_tesseract_available
from .jobs import JobManager, validate_job
from .supabase_rest import (
    ConversionConflict,
    DocumentNotFound,
    JobNotFound,
    SupabaseError,
    SupabaseRest,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

settings = Settings()
manager = JobManager(settings)


class JobRequest(BaseModel):
    document_id: str = Field(min_length=36, max_length=36)
    job_id: str = Field(min_length=36, max_length=36)
    user_id: str = Field(min_length=36, max_length=36)


def require_processor_key(x_processor_key: str | None = Header(default=None)) -> None:
    if not settings.processor_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The processing service is not configured.",
        )
    if not x_processor_key or not secrets.compare_digest(
        x_processor_key, settings.processor_api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorised.",
        )


def _ocr_available() -> bool:
    try:
        check_tesseract_available(settings.tesseract_cmd)
        return True
    except Exception:
        return False


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "FlowParse processor starting (mode=%s, workers=%s, ocr_enabled=%s)",
        settings.processing_mode,
        settings.processor_workers,
        settings.ocr_enabled,
    )
    if not settings.supabase_service_role_key or not settings.processor_api_key:
        logger.warning("Processor credentials are incomplete; jobs will be rejected.")
    if settings.processing_mode == "queued":
        logger.info("Queued mode: the processor-worker daemon claims and runs jobs.")
    elif settings.ocr_enabled and not _ocr_available():
        logger.warning("OCR is enabled but Tesseract is not available on this server.")

    if settings.processing_mode == "embedded" and settings.supabase_service_role_key:
        try:
            recovered = await run_in_threadpool(
                lambda: SupabaseRest(settings).claim_stale_jobs(settings.stale_job_minutes)
            )
            if recovered:
                logger.info("Recovered %s interrupted job(s).", recovered)
        except Exception:
            logger.exception("Could not recover interrupted jobs at startup.")
    yield
    manager.shutdown()


app = FastAPI(
    title="FlowParse Processor",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "flowparse-processor", "status": "ok"}


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "version": "0.1.0",
        "ocr_enabled": settings.ocr_enabled,
        "ocr_available": _ocr_available() if settings.ocr_enabled else False,
        "configured": bool(settings.supabase_service_role_key and settings.processor_api_key),
    }


@app.post("/v1/jobs", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_processor_key)])
async def create_job(request: JobRequest) -> dict[str, str]:
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The processing service is not configured.",
        )
    try:
        if settings.processing_mode == "queued":
            # The worker daemon owns claiming and execution in production.
            await run_in_threadpool(
                validate_job,
                SupabaseRest(settings),
                request.document_id,
                request.job_id,
                request.user_id,
            )
        else:
            await run_in_threadpool(
                manager.submit, request.document_id, request.job_id, request.user_id
            )
    except (DocumentNotFound, JobNotFound):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found.")
    except ConversionConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except SupabaseError:
        logger.exception("Could not queue document %s", request.document_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The processing service could not queue this statement. Please retry.",
        )
    return {
        "status": "accepted",
        "document_id": request.document_id,
        "job_id": request.job_id,
    }
