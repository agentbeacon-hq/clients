"""Openpath for Python: search live listings in one call.

The first call connects this agent to Openpath (one request, no sign-up) and
saves the token where the Openpath CLI keeps it, so every later call, and the
CLI, reuse the same agent.

    from openpath_sh import search

    print(search("plumber near Austin, TX"))
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

__all__ = ["Openpath", "OpenpathError", "search", "get_listing", "VERSION", "DEFAULT_API"]

VERSION = "0.3.1"
DEFAULT_API = "https://api.openpath.sh"
CATEGORIES = ("jobs", "businesses", "homes", "products")

# (method, url, headers, body) -> (status, headers, body text)
Send = Callable[[str, str, dict, Optional[bytes]], "tuple[int, dict, str]"]


class OpenpathError(Exception):
    """A refusal from Openpath, with what it said and how long to wait."""

    def __init__(self, status: int, message: str, code: str | None, retry_after: int | None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.retry_after = retry_after


def _setting(env: dict, name: str) -> str:
    """A setting named OPENPATH_<NAME>, as the CLI and the skill name them."""
    return (env.get(f"OPENPATH_{name}") or "").strip()


def _detect_agent(env: dict) -> str | None:
    """The agent running this code, if one is, from the variables agents set."""
    named = (env.get("AI_AGENT") or "").strip()
    if named:
        return re.sub(r"[^A-Za-z0-9._-]+", "-", named)[:40] or None
    if env.get("CURSOR_TRACE_ID") or env.get("CURSOR_AGENT"):
        return "cursor"
    if env.get("GEMINI_CLI"):
        return "gemini-cli"
    if env.get("CODEX_SANDBOX") or env.get("CODEX_CI") or env.get("CODEX_THREAD_ID"):
        return "codex"
    if env.get("CLAUDECODE") or env.get("CLAUDE_CODE"):
        return "claude-code"
    if env.get("REPL_ID"):
        return "replit"
    return None


def _credentials_file(env: dict, home: Path) -> Path:
    chosen = _setting(env, "CONFIG_DIR")
    if chosen:
        return Path(chosen) / "credentials.json"
    if sys.platform == "win32" and (env.get("APPDATA") or "").strip():
        return Path(env["APPDATA"].strip()) / "openpath" / "credentials.json"
    config = (env.get("XDG_CONFIG_HOME") or "").strip() or str(home / ".config")
    return Path(config) / "openpath" / "credentials.json"


def _read_all(path: Path) -> dict:
    try:
        parsed = json.loads(path.read_text("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_all(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(data, indent=2) + "\n")
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def _urllib_send(method: str, url: str, headers: dict, body: bytes | None) -> tuple[int, dict, str]:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers), response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read().decode("utf-8", "replace")


def _refusal(status: int, headers: dict, text: str) -> OpenpathError:
    detail, code = text[:500], None
    try:
        problem = json.loads(text)
        if isinstance(problem.get("detail"), str):
            detail = problem["detail"]
        if isinstance(problem.get("code"), str):
            code = problem["code"]
    except (ValueError, AttributeError):
        pass
    retry = {k.lower(): v for k, v in headers.items()}.get("retry-after")
    retry_after = int(retry) if retry and retry.isdigit() and int(retry) > 0 else None
    return OpenpathError(status, detail or f"Openpath answered {status}.", code, retry_after)


class Openpath:
    """One agent's way into Openpath. Most code needs only `search`."""

    def __init__(
        self,
        api_url: str | None = None,
        token: str | None = None,
        app: str | None = None,
        save_token: bool = True,
        send: Send | None = None,
        env: dict | None = None,
        home: Path | None = None,
    ):
        env = dict(os.environ) if env is None else env
        self.api = (api_url or _setting(env, "API_URL") or DEFAULT_API).rstrip("/")
        self.send = send or _urllib_send
        self.save = save_token
        self.file = _credentials_file(env, home or Path.home())
        name = (app or "").strip() or _setting(env, "USER_AGENT") or _detect_agent(env)
        own = f"openpath-python/{VERSION} (+https://github.com/openpath-sh/clients)"
        self.user_agent = f"{name} {own}" if name else own
        self.token = (token or "").strip() or _setting(env, "AGENT_TOKEN") or None
        self._lock = threading.Lock()

    def connect(self) -> str:
        """The saved token, or a new one from POST /v1/connect: one call, no account or sign-up."""
        with self._lock:
            if self.token:
                return self.token
            saved = _read_all(self.file).get(self.api) or {}
            if saved.get("token"):
                self.token = saved["token"]
                return self.token
            status, headers, text = self.send(
                "POST",
                f"{self.api}/v1/connect",
                {"Content-Type": "application/json", "User-Agent": self.user_agent},
                b"{}",
            )
            if not 200 <= status < 300:
                raise _refusal(status, headers, text)
            created = json.loads(text)
            if self.save:
                try:
                    all_saved = _read_all(self.file)
                    all_saved[self.api] = {
                        "agent_id": created.get("agent_id"),
                        "token": created["token"],
                        "connected_at": datetime.now(timezone.utc).isoformat(),
                    }
                    _write_all(self.file, all_saved)
                except OSError:
                    pass
            self.token = created["token"]
            return self.token

    def search(
        self,
        query: str,
        near: str | None = None,
        category: str | None = None,
        offset: int | None = None,
    ) -> str:
        """Live listings that fit what the person asked for, as plain Markdown: each
        result's facts, how to act on it (the inbox address that reaches its owner, and for a job the Apply link) and where it
        came from."""
        if category is not None and category not in CATEGORIES:
            raise ValueError(f"category is one of {', '.join(CATEGORIES)}.")
        params = {"q": query}
        for key, value in (("near", near), ("category", category), ("offset", offset)):
            if value:
                params[key] = str(value)
        return self._get(f"/v1/search?{urllib.parse.urlencode(params)}")

    def get_listing(self, listing_id: str) -> str:
        """One listing in full, as Markdown, by the id at the end of a result's Link line."""
        return self._get(f"/v1/listings/{urllib.parse.quote(listing_id, safe='')}")

    def _get(self, path: str) -> str:
        for attempt in range(2):
            token = self.connect()
            status, headers, text = self.send(
                "GET",
                f"{self.api}{path}",
                {
                    "Accept": "text/markdown",
                    "Authorization": f"Bearer {token}",
                    "User-Agent": self.user_agent,
                },
                None,
            )
            if 200 <= status < 300:
                return text
            # A token that was revoked or never existed: connect again, once.
            if status == 401 and attempt == 0:
                self._forget_token()
                continue
            raise _refusal(status, headers, text)
        raise OpenpathError(401, "Openpath did not accept a new token.", None, None)

    def _forget_token(self) -> None:
        with self._lock:
            self.token = None
            if not self.save:
                return
            all_saved = _read_all(self.file)
            if all_saved.pop(self.api, None) is not None:
                try:
                    _write_all(self.file, all_saved)
                except OSError:
                    pass


_shared: Openpath | None = None


def _client() -> Openpath:
    global _shared
    if _shared is None:
        _shared = Openpath()
    return _shared


def search(
    query: str, near: str | None = None, category: str | None = None, offset: int | None = None
) -> str:
    """Search Openpath with a client shared across calls."""
    return _client().search(query, near=near, category=category, offset=offset)


def get_listing(listing_id: str) -> str:
    """Read one listing with a client shared across calls."""
    return _client().get_listing(listing_id)
