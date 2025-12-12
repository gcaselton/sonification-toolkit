from contextvars import ContextVar
from typing import Optional

# Defining a context variable so session_id can be accessed from anywhere
session_id_var: ContextVar[Optional[str]] = ContextVar('session_id', default=None)