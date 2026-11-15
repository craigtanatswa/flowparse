from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .config import Settings
from .extract.models import ExtractionError, ExtractionResult
from .extract.pipeline import extract_pdf
from .supabase_rest import (
    ConversionConflict,
    DocumentNotFound,
    SupabaseError,
    SupabaseRest,
)

logger = logging.getLogger(__name__)


class ProcessorBusyError(RuntimeError):
    pass


class JobManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.executor = ThreadPoolExecutor(
            max_workers=max(1, settings.processor_workers),
            thread_name_prefix="flowparse-extract",
        )
        self._active: set[str] = set()
        self._lock = threading.Lock()

    def submit(self, document_id: str, job_id: str, user_id: str) -> None:
        with self._lock:
            if job_id in self._active:
                raise ConversionConflict("This conversion is already queued for processing.")
            self._active.add(job_id)

        db = SupabaseRest(self.settings)
        try:
            job = db.get_job(job_id)
            if job["document_id"] != document_id or job["user_id"] != user_id:
                raise DocumentNotFound("Document not found.")
            if job["status"] in {"completed", "partial"}:
                raise ConversionConflict(
                    "This statement has already been processed. Create a new upload to extract it again."
                )
            if job["status"] not in {"queued", "processing"}:
                raise ConversionConflict("This conversion is not queued for processing.")

            document = db.get_document(document_id)
            if document["user_id"] != user_id:
                raise DocumentNotFound("Document not found.")
            if document["status"] in {"completed", "partial"}:
                raise ConversionConflict(
                    "This statement has already been processed. Create a new upload to extract it again."
                )

            db.claim_job(job_id, document_id)
            self.executor.submit(self._run_and_cleanup, document, job)
        except Exception:
            with self._lock:
                self._active.discard(job_id)
            raise

    def _run_and_cleanup(self, document: dict[str, Any], job: dict[str, Any]) -> None:
        job_id = str(job["id"])
        try:
            self._run(document, job)
        finally:
            with self._lock:
                self._active.discard(job_id)

    def _run(self, document: dict[str, Any], job: dict[str, Any]) -> None:
        document_id = str(document["id"])
        job_id = str(job["id"])
        db = SupabaseRest(self.settings)
        logger.info(
            "Processing document %s (job %s, attempt %s)",
            document_id,
            job_id,
            job.get("attempt"),
        )
        last_progress: tuple[str, int] | None = None

        def report(stage: str, percent: int) -> None:
            nonlocal last_progress
            key = (stage, percent)
            if key == last_progress:
                return
            last_progress = key
            try:
                db.update_progress(job_id, stage, percent)
            except Exception:
                # Progress is telemetry, not a reason to fail an extraction.
                # Catch transport errors as well as rejected HTTP responses.
                logger.debug("Could not record progress for job %s", job_id)

        try:
            report("Preparing the document", 1)
            file_size = int(document.get("file_size") or 0)
            if file_size > self.settings.max_file_bytes:
                raise ExtractionError(
                    f"The PDF is larger than the {self.settings.max_file_mb} MB processing limit."
                )

            report("Downloading the original PDF", 2)
            data = db.download_document(document)
            report("Checking the PDF", 4)
            result: ExtractionResult = extract_pdf(
                data,
                ocr_enabled=self.settings.ocr_enabled,
                ocr_dpi=self.settings.ocr_dpi,
                ocr_language=self.settings.tesseract_lang,
                tesseract_cmd=self.settings.tesseract_cmd,
                max_pages=self.settings.max_pages,
                progress=report,
            )
            report("Saving extracted transactions", 96)
            payload = result.to_json()
            db.save_result(document_id, job_id, payload)
            logger.info(
                "Document %s finished with status=%s transactions=%s (job %s)",
                document_id,
                result.status,
                len(result.transactions),
                job_id,
            )
        except ExtractionError as exc:
            message = str(exc)
            logger.warning("Document %s failed: %s", document_id, message)
            self._mark_failed(db, job_id, message)
        except SupabaseError as exc:
            logger.exception(
                "Document %s database/storage failure (type=%s, status=%s)",
                document_id,
                type(exc).__name__,
                getattr(exc, "status_code", None),
            )
            self._mark_failed(
                db,
                job_id,
                "The document was processed, but its results could not be saved. Please retry.",
            )
        except Exception:
            logger.exception("Unexpected processing failure for document %s", document_id)
            self._mark_failed(
                db,
                job_id,
                "Extraction failed unexpectedly. The document may use an unsupported layout. Please retry or enter the transactions manually.",
            )

    def _mark_failed(self, db: SupabaseRest, job_id: str, message: str) -> None:
        try:
            db.mark_failed(job_id, message)
        except Exception:
            logger.exception("Could not record failure for job %s", job_id)

    def shutdown(self) -> None:
        self.executor.shutdown(wait=False, cancel_futures=True)
