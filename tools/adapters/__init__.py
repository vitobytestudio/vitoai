"""Adapters are discovered, never registered.

Drop ``perplexity.py`` in this folder, give it a class that subclasses ``BaseAdapter`` and sets a
``name``, and ``--platform perplexity`` works — no edit to the runner, the engine, or anything
else here. ``base.py``, files starting with ``_``, and anything that fails to import are skipped
(the last one loudly, because a silent disappearance is how a half-written adapter wastes an
evening).

``extra=`` lets a checkout, a scratch dir, or a test point at adapters that live somewhere else;
they are loaded by file path and may import ``tools.adapters.base`` as normal.
"""
from __future__ import annotations

import importlib
import importlib.util
import inspect
import sys
from pathlib import Path
from typing import Iterable, Optional

if __package__ in (None, ""):  # pragma: no cover - direct execution
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "tools.adapters"

from tools.adapters.base import BaseAdapter, Config, NoResult, NotSettled, SessionExpired, contract  # noqa: F401

HERE = Path(__file__).resolve().parent


def _is_adapter(obj) -> bool:
    return (
        inspect.isclass(obj)
        and issubclass(obj, BaseAdapter)
        and obj is not BaseAdapter
        and bool(getattr(obj, "name", ""))
        and not inspect.isabstract(obj)
    )


def _load_file(path: Path, register: bool = True):
    mod_name = f"tools.adapters._ext_{path.stem}"
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)  # noqa: S102 - operator-supplied adapter file, by design
    return mod


def load(extra: Iterable[str | Path] = ()) -> tuple[dict, list]:
    """Return ``({platform: class}, [problems])``. A broken adapter is a problem, not a crash."""
    found: dict[str, type[BaseAdapter]] = {}
    problems: list[str] = []

    files = sorted(p for p in HERE.glob("*.py") if not p.name.startswith(("_", "base.")))
    seen = {p.name for p in files}
    for raw in extra or ():
        p = Path(raw).expanduser()
        if p.is_dir():
            files.extend(sorted(x for x in p.glob("*.py") if not x.name.startswith(("_", "base.")) and x.name not in seen))
            seen |= {x.name for x in files}
        elif p.suffix == ".py":
            files.append(p)
        else:
            problems.append(f"{p}: not a .py file or a directory")

    for path in files:
        inside_pkg = path.parent == HERE
        try:
            mod = importlib.import_module(f"{__name__}.{path.stem}") if inside_pkg else _load_file(path)
        except Exception as e:
            problems.append(f"{path.name}: import failed — {type(e).__name__}: {e}")
            continue
        if mod is None:
            problems.append(f"{path.name}: could not be loaded")
            continue
        got = 0
        for obj in vars(mod).values():
            if not _is_adapter(obj):
                continue
            got += 1
            key = obj.name.lower()
            if key in found and found[key] is not obj:
                problems.append(f"{path.name}: '{key}' already provided by {found[key].__module__} — ignored")
                continue
            found[key] = obj
            for alias in obj.aliases:
                found.setdefault(str(alias).lower(), obj)
        if not got:
            problems.append(f"{path.name}: no BaseAdapter subclass with a `name`")
    return found, problems


def resolve(name: str, adapters: Optional[dict] = None, extra: Iterable[str | Path] = ()) -> type[BaseAdapter]:
    adapters = adapters if adapters is not None else load(extra)[0]
    key = (name or "").strip().lower()
    if key in adapters:
        return adapters[key]
    for cls in adapters.values():
        if cls.matches(key):
            return cls
    raise KeyError(key)


def catalogue(extra: Iterable[str | Path] = ()) -> list:
    adapters, _ = load(extra)
    return [contract(c) for c in sorted({id(v): v for v in adapters.values()}.values(), key=lambda c: c.name)]


__all__ = ["BaseAdapter", "Config", "SessionExpired", "NotSettled", "NoResult", "contract", "load", "resolve", "catalogue"]
