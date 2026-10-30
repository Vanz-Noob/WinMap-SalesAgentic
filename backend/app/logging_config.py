"""Centralized application & security logging (OWASP A09).

- Logger "security" untuk event keamanan: login sukses/gagal, 401, 403,
  perubahan role/admin, aksi agent LLM.
- JANGAN log: password, token, header Authorization, isi payload sensitif.
- Format key=value agar mudah diparsing oleh Loki/ELK.
"""
import logging
import sys

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"

security_logger = logging.getLogger("security")


def setup_logging(level: str = "INFO") -> None:
    """Configure root logging once at app startup."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # uvicorn.access menyalin http logs kita — hilangkan duplikasi
    for noisy in ("uvicorn.access", "uvicorn.error"):
        lg = logging.getLogger(noisy)
        lg.handlers = [handler]
        lg.propagate = False
