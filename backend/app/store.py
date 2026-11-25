"""Storage abstraction: Supabase PostgreSQL when configured, persistent JSON otherwise."""

from __future__ import annotations

import json
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import settings
from .domain import now
from .seed import build_seed

COLLECTIONS = (
    "users",
    "business_profiles",
    "materials",
    "listings",
    "buyer_requirements",
    "business_discovery_results",
    "enquiries",
    "offers",
    "negotiations",
    "orders",
    "payments",
    "refunds",
    "shipments",
    "transporters",
    "subscriptions",
    "material_passports",
)


def _matches(item: dict[str, Any], filters: dict[str, Any]) -> bool:
    for key, expected in filters.items():
        actual = item.get(key)
        if isinstance(expected, dict):
            for op, value in expected.items():
                if op == "ne" and actual == value:
                    return False
                if op == "in" and actual not in value:
                    return False
                if op == "gte" and (actual is None or actual < value):
                    return False
                if op == "lte" and (actual is None or actual > value):
                    return False
                if op == "contains" and str(value).lower() not in str(actual or "").lower():
                    return False
        elif isinstance(expected, (list, tuple, set)):
            if actual not in expected:
                return False
        elif actual != expected:
            return False
    return True


class JsonStore:
    """File-backed demo store. Seeded on first run and safe for local development."""

    def __init__(self, path: Path | None = None):
        self.path = path or (settings.DATA_DIR / "demo_store.json")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._data: dict[str, list[dict[str, Any]]] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                loaded = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict) and all(c in loaded for c in COLLECTIONS):
                    self._data = loaded
                    return
            except (OSError, json.JSONDecodeError):
                pass
        self._data = build_seed()
        self.save()

    def save(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)

    def reset(self) -> None:
        with self._lock:
            self._data = build_seed()
            self.save()

    def list(self, collection: str, **filters: Any) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._data.get(collection, [])
            return [deepcopy(r) for r in rows if _matches(r, filters)]

    def get(self, collection: str, item_id: str) -> dict[str, Any] | None:
        with self._lock:
            for row in self._data.get(collection, []):
                if row.get("id") == item_id:
                    return deepcopy(row)
        return None

    def create(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            row = deepcopy(data)
            timestamp = now()
            row.setdefault("created_at", timestamp)
            row.setdefault("updated_at", timestamp)
            self._data.setdefault(collection, []).append(row)
            self.save()
            return deepcopy(row)

    def update(self, collection: str, item_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            for row in self._data.get(collection, []):
                if row.get("id") == item_id:
                    row.update(deepcopy(patch))
                    row["updated_at"] = (
                        datetime.now(timezone.utc)
                        .isoformat(timespec="seconds")
                        .replace("+00:00", "Z")
                    )
                    self.save()
                    return deepcopy(row)
        return None

    def delete(self, collection: str, item_id: str) -> bool:
        with self._lock:
            rows = self._data.get(collection, [])
            before = len(rows)
            self._data[collection] = [r for r in rows if r.get("id") != item_id]
            changed = len(self._data[collection]) != before
            if changed:
                self.save()
            return changed


class SupabaseStore:
    """Supabase adapter. Run backend/app/sql/schema.sql once before using it."""

    def __init__(self, url: str, key: str):
        from supabase import create_client  # optional dependency

        self.client = create_client(url, key)
        self._lock = threading.RLock()

    def list(self, collection: str, **filters: Any) -> list[dict[str, Any]]:
        try:
            response = self.client.table(collection).select("*").execute()
            rows = response.data or []
        except Exception as exc:  # pragma: no cover - depends on live credentials
            raise RuntimeError(f"Supabase read failed for {collection}: {exc}") from exc
        return [r for r in rows if _matches(r, filters)]

    def get(self, collection: str, item_id: str) -> dict[str, Any] | None:
        try:
            response = self.client.table(collection).select("*").eq("id", item_id).execute()
            rows = response.data or []
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(f"Supabase read failed for {collection}: {exc}") from exc
        return rows[0] if rows else None

    def create(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table(collection).insert(data).execute()
        return (response.data or [data])[0]

    def update(self, collection: str, item_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        response = self.client.table(collection).update(patch).eq("id", item_id).execute()
        rows = response.data or []
        return rows[0] if rows else None

    def delete(self, collection: str, item_id: str) -> bool:
        response = self.client.table(collection).delete().eq("id", item_id).execute()
        return bool(response.data)

    def save(self) -> None:
        return None

    def reset(self) -> None:
        raise RuntimeError("reset() is disabled when Supabase is configured")


def _seed_supabase(store: SupabaseStore) -> None:
    """Populate a fresh Supabase project with the same labelled demo dataset."""
    try:
        if store.list("users"):
            return
        seed = build_seed()
        for collection, rows in seed.items():
            for row in rows:
                store.create(collection, row)
        print("[ReSource AI] Seeded Supabase with demo data.")
    except Exception as exc:  # pragma: no cover - depends on live credentials/schema
        print(f"[ReSource AI] Supabase seeding skipped ({exc}); run app/sql/schema.sql first.")


_store: JsonStore | SupabaseStore | None = None
_store_lock = threading.Lock()


def get_store() -> JsonStore | SupabaseStore:
    global _store
    with _store_lock:
        if _store is None:
            if settings.supabase_configured:
                try:
                    _store = SupabaseStore(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
                    _seed_supabase(_store)
                except Exception as exc:  # graceful fallback, logged by caller if needed
                    print(f"[ReSource AI] Supabase unavailable ({exc}); using demo JSON store.")
                    _store = JsonStore()
            else:
                _store = JsonStore()
        return _store


def all_of(collection: str, **filters: Any) -> list[dict[str, Any]]:
    return get_store().list(collection, **filters)
