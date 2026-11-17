from __future__ import annotations

import logging
import signal
import threading

from .config import Settings
from .jobs import process_job
from .supabase_rest import SupabaseError, SupabaseRest

logger = logging.getLogger(__name__)


def process_one(settings: Settings, db: SupabaseRest) -> bool:
    """Claim and process at most one queued job.

    Returns True when a job was claimed, whether extraction succeeded or the
    job was marked failed by process_job.
    """
    claimed = db.claim_next_job()
    if not claimed:
        return False
    job, document = claimed
    process_job(settings, document, job)
    return True


def run(settings: Settings, shutdown: threading.Event | None = None) -> None:
    """Poll the conversion queue until shutdown is requested.

    The current job is always allowed to finish. Vercel sends SIGTERM during
    deploy/scale-down, and the daemon's termination grace period gives this
    loop time to drain.
    """
    stop = shutdown or threading.Event()
    db = SupabaseRest(settings)

    try:
        # Queued jobs are not interrupted; leave them for this worker. Only
        # jobs stuck in "processing" after a crash/restart need recovery.
        recovered = db.claim_stale_jobs(
            settings.stale_job_minutes, include_queued=False
        )
        if recovered:
            logger.info("Recovered %s interrupted job(s).", recovered)
    except Exception:
        logger.exception("Could not recover interrupted jobs at startup.")

    while not stop.is_set():
        try:
            processed = process_one(settings, db)
        except SupabaseError:
            logger.exception("Could not poll for queued jobs.")
            stop.wait(settings.worker_poll_seconds)
            continue
        except Exception:
            logger.exception("Unexpected processor worker failure.")
            stop.wait(settings.worker_poll_seconds)
            continue

        if not processed:
            stop.wait(settings.worker_poll_seconds)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = Settings()
    if not settings.supabase_service_role_key:
        logger.error("SUPABASE_SERVICE_ROLE_KEY is not configured; worker cannot start.")
        raise SystemExit(1)

    shutdown = threading.Event()

    def request_shutdown(signum: int, _frame: object) -> None:
        logger.info("Received signal %s; finishing the current job and exiting.", signum)
        shutdown.set()

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    logger.info(
        "FlowParse processor worker starting (poll=%ss).",
        settings.worker_poll_seconds,
    )
    run(settings, shutdown)
    logger.info("FlowParse processor worker stopped.")


if __name__ == "__main__":
    main()
