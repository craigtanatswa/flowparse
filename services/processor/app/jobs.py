from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .config import Settings
from .extract.models import ExtractionError, ExtractionResult
from .extract.pipeline import extract_pdf
from .supabase_rest import StatementConflict, StatementNotFound, SupabaseError, SupabaseRest

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

    def submit(self, statement_id: str, user_id: str) -> None:
        with self._lock:
            if statement_id in self._active:
                raise StatementConflict("This statement is already queued for processing.")
            self._active.add(statement_id)

        db = SupabaseRest(self.settings)
        try:
            statement = db.get_statement(statement_id)
            if statement["user_id"] != user_id:
                raise StatementNotFound("Statement not found.")
            if statement["status"] in {"completed", "partial"}:
                raise StatementConflict(
                    "This statement has already been processed. Create a new upload to extract it again."
                )
            db.claim_statement(statement_id)
            self.executor.submit(self._run_and_cleanup, statement)
        except Exception:
            with self._lock:
                self._active.discard(statement_id)
            raise

    def _run_and_cleanup(self, statement: dict[str, Any]) -> None:
        statement_id = str(statement["id"])
        try:
            self._run(statement)
        finally:
            with self._lock:
                self._active.discard(statement_id)

    def _run(self, statement: dict[str, Any]) -> None:
        statement_id = str(statement["id"])
        db = SupabaseRest(self.settings)
        logger.info("Processing statement %s", statement_id)
        last_progress: tuple[str, int] | None = None

        def report(stage: str, percent: int) -> None:
            nonlocal last_progress
            key = (stage, percent)
            if key == last_progress:
                return
            last_progress = key
            try:
                db.update_progress(statement_id, stage, percent)
            except Exception:
                # Progress is telemetry, not a reason to fail an extraction.
                # Catch transport errors as well as rejected HTTP responses.
                logger.debug(
                    "Could not record progress for statement %s", statement_id
                )

        try:
            report("Preparing the document", 1)
            file_size = int(statement.get("file_size") or 0)
            if file_size > self.settings.max_file_bytes:
                raise ExtractionError(
                    f"The PDF is larger than the {self.settings.max_file_mb} MB processing limit."
                )

            report("Downloading the original PDF", 2)
            data = db.download_statement(statement)
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
            db.save_result(statement_id, payload)
            logger.info(
                "Statement %s finished with status=%s transactions=%s",
                statement_id,
                result.status,
                len(result.transactions),
            )
        except ExtractionError as exc:
            message = str(exc)
            logger.warning("Statement %s failed: %s", statement_id, message)
            self._mark_failed(db, statement_id, message)
        except SupabaseError as exc:
            logger.exception(
                "Statement %s database/storage failure (type=%s, status=%s)",
                statement_id,
                type(exc).__name__,
                getattr(exc, "status_code", None),
            )
            self._mark_failed(
                db,
                statement_id,
                "The document was processed, but its results could not be saved. Please retry.",
            )
        except Exception:
            logger.exception("Unexpected processing failure for statement %s", statement_id)
            self._mark_failed(
                db,
                statement_id,
                "Extraction failed unexpectedly. The document may use an unsupported layout. Please retry or enter the transactions manually.",
            )

    def _mark_failed(self, db: SupabaseRest, statement_id: str, message: str) -> None:
        try:
            db.mark_failed(statement_id, message)
        except Exception:
            logger.exception("Could not record failure for statement %s", statement_id)

    def shutdown(self) -> None:
        self.executor.shutdown(wait=False, cancel_futures=True)
