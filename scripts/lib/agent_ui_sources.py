#!/usr/bin/env python3
"""Generate docs/agent-ui-sources.json — testID → source file index.

Usage:
  python3 scripts/lib/agent_ui_sources.py              # write JSON
  python3 scripts/lib/agent_ui_sources.py --check       # exit 1 if stale
  python3 scripts/lib/agent_ui_sources.py --lookup ID   # print one entry
  python3 scripts/lib/agent_ui_sources.py --label TEXT  # search labels in map
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Feature → AGENTS.md entry points / skills (keep in sync with AGENTS.md table).
FEATURE_ENTRIES: dict[str, dict[str, str]] = {
    "tabs": {"entry": "src/app/(tabs)/_layout.tsx"},
    "chrome": {"entry": "src/components/primitives/"},
    "today": {"entry": "src/features/daily-tracking/day-view.tsx"},
    "calendar": {"entry": "src/app/(tabs)/calendar.tsx"},
    "checklists": {
        "entry": "src/features/todos/todo-list-screen.tsx",
        "skill": ".cursor/skills/todos/SKILL.md",
    },
    "todos": {
        "entry": "src/features/todos/todo-list-screen.tsx",
        "skill": ".cursor/skills/todos/SKILL.md",
    },
    "grocery": {
        "entry": "src/features/todos/grocery-list-screen.tsx",
        "skill": ".cursor/skills/todos/SKILL.md",
    },
    "recipeImport": {
        "entry": "src/features/todos/recipe-import-screen.tsx",
        "skill": ".cursor/skills/todos/SKILL.md",
    },
    "social": {"entry": "src/app/(tabs)/social.tsx"},
    "insights": {"entry": "src/app/(tabs)/insights.tsx"},
    "profile": {"entry": "src/features/account/"},
    "workouts": {
        "entry": "src/app/(tabs)/workouts.tsx",
        "skill": ".cursor/skills/workouts/SKILL.md",
    },
    "plants": {"entry": "src/app/(tabs)/plants/index.tsx"},
    "travel": {
        "entry": "src/app/(tabs)/travel.tsx",
        "skill": ".cursor/skills/travel/SKILL.md",
    },
    "visionBoard": {
        "entry": "src/features/vision-board/",
        "skill": ".cursor/skills/vision-board/SKILL.md",
    },
    "games": {"entry": "src/app/(tabs)/games.tsx"},
    "vehicles": {"entry": "src/app/(tabs)/vehicles/index.tsx"},
    "health": {
        "entry": "src/app/(tabs)/health/index.tsx",
        "skill": ".cursor/skills/health/SKILL.md",
    },
    "activity": {"entry": "src/app/activity-form.tsx"},
    "food": {"entry": "src/app/detail/food/[id].tsx"},
    "designSystem": {"entry": "src/app/design-system.tsx"},
    "agentUi": {"entry": "src/utils/agent-ui/"},
}

STATIC_ID_RE = re.compile(r"'(ontrack\.[^']+)'")
SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    ".expo",
    "dist",
    "build",
    "coverage",
    "__tests__",
    "android",
    "ios",
}
SKIP_FILE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".apk", ".zip")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def extract_static_ids(ids_path: Path) -> list[str]:
    """Collect static ontrack.* literals from ids.ts and split ids-*.ts modules."""
    folder = ids_path.parent if ids_path.is_file() else ids_path
    paths = sorted(
        p
        for p in folder.glob("ids*.ts")
        if p.is_file() and ".test." not in p.name
    )
    if not paths and ids_path.is_file():
        paths = [ids_path]
    found: set[str] = set()
    for path in paths:
        # Drop template-literal factory bodies — only static string literals.
        found.update(STATIC_ID_RE.findall(path.read_text(encoding="utf-8")))
    return sorted(found)


def feature_for_id(test_id: str) -> str:
    if not test_id.startswith("ontrack."):
        return "unknown"
    rest = test_id[len("ontrack.") :]
    return rest.split(".", 1)[0] if rest else "unknown"


def iter_source_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for base in (root / "src", root / "docs"):
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            if path.suffix.lower() in SKIP_FILE_SUFFIXES:
                continue
            if path.suffix.lower() not in {
                ".ts",
                ".tsx",
                ".js",
                ".jsx",
                ".md",
                ".mdc",
            }:
                continue
            out.append(path)
    return out


def build_index(root: Path) -> dict:
    ids_path = root / "src/utils/agent-ui/ids.ts"
    static_ids = extract_static_ids(ids_path)
    sys.path.insert(0, str(root / "scripts/lib"))
    from agent_ui_ids import load_id_aliases  # type: ignore

    aliases = load_id_aliases(str(ids_path))
    # wire id → search needles (wire + AgentUiIds key paths that map to it)
    needles_by_wire: dict[str, set[str]] = {tid: {tid} for tid in static_ids}
    for alias, wire in aliases.items():
        if wire not in needles_by_wire:
            continue
        if alias.startswith("ontrack."):
            continue
        needles_by_wire[wire].add(alias)
        # Also search "AgentUiIds.travel.planDetail.weather" style already in alias.
        # Prefer dotted key paths that appear in source: travel.planDetail.weather
        if "." in alias and not alias.startswith("AgentUiIds."):
            needles_by_wire[wire].add(f"AgentUiIds.{alias}")

    files = iter_source_files(root)
    # Pre-read file texts (exclude ids.ts as sole match when others exist).
    contents: list[tuple[Path, str]] = []
    for path in files:
        try:
            contents.append((path, path.read_text(encoding="utf-8")))
        except OSError:
            continue

    by_id: dict[str, dict] = {}
    for test_id in static_ids:
        feature = feature_for_id(test_id)
        feature_meta = FEATURE_ENTRIES.get(feature, {})
        needles = needles_by_wire.get(test_id) or {test_id}
        matches: list[str] = []
        for path, text in contents:
            if not any(n in text for n in needles):
                continue
            rel = str(path.relative_to(root))
            # Definition modules are not usage sites.
            if rel.startswith("src/utils/agent-ui/ids") and rel.endswith(".ts"):
                continue
            if rel == "docs/agent-ui-map.md":
                continue
            if rel.endswith("agent-ui-sources.json"):
                continue
            matches.append(rel)
        # Prefer feature code over docs/tests-only noise.
        matches.sort(
            key=lambda p: (
                0 if p.startswith("src/") else 1,
                0 if "/agent-ui/" not in p else 1,
                p,
            )
        )
        entry = feature_meta.get("entry")
        by_id[test_id] = {
            "feature": feature,
            "entry": entry,
            "skill": feature_meta.get("skill"),
            "files": matches[:12],
            "keyPaths": sorted(
                a
                for a in needles
                if a != test_id and not a.startswith("AgentUiIds.")
            )[:6],
        }

    by_feature: dict[str, dict] = {}
    for test_id, meta in by_id.items():
        feature = meta["feature"]
        bucket = by_feature.setdefault(
            feature,
            {
                "entry": FEATURE_ENTRIES.get(feature, {}).get("entry"),
                "skill": FEATURE_ENTRIES.get(feature, {}).get("skill"),
                "ids": [],
            },
        )
        bucket["ids"].append(test_id)
    for bucket in by_feature.values():
        bucket["ids"] = sorted(bucket["ids"])

    return {
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "idCount": len(by_id),
        "byId": by_id,
        "byFeature": by_feature,
    }


def sources_path(root: Path) -> Path:
    return root / "docs/agent-ui-sources.json"


def write_index(root: Path) -> dict:
    payload = build_index(root)
    path = sources_path(root)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def load_index(root: Path) -> dict:
    path = sources_path(root)
    if not path.is_file():
        return write_index(root)
    return json.loads(path.read_text(encoding="utf-8"))


def lookup_id(root: Path, raw: str) -> dict | None:
    # Lazy import to avoid circular when bridge loads ids helper.
    sys.path.insert(0, str(root / "scripts/lib"))
    from agent_ui_ids import resolve_test_id  # type: ignore

    wire = resolve_test_id(raw, root=root)
    index = load_index(root)
    by_id = index.get("byId") or {}
    hit = by_id.get(wire)
    if hit:
        return {"testID": wire, **hit}
    # Prefix / factory: find longest static prefix match.
    best_key = ""
    for key in by_id:
        if wire.startswith(key.rstrip(".")) or key.startswith(wire):
            if len(key) > len(best_key):
                best_key = key
    # Also match factory-style: ontrack.health.mind.entry.XYZ → mind.entry pattern files
    feature = feature_for_id(wire)
    feature_meta = FEATURE_ENTRIES.get(feature, {})
    # Collect files that contain a prefix of the wire id (up to 4 segments).
    parts = wire.split(".")
    file_hits: list[str] = []
    for n in range(min(len(parts), 6), 2, -1):
        prefix = ".".join(parts[:n])
        for key, meta in by_id.items():
            if key.startswith(prefix) or prefix.startswith(key):
                for f in meta.get("files") or []:
                    if f not in file_hits:
                        file_hits.append(f)
        if file_hits:
            break
    return {
        "testID": wire,
        "feature": feature,
        "entry": feature_meta.get("entry"),
        "skill": feature_meta.get("skill"),
        "files": file_hits[:12],
        "nearestStaticId": best_key or None,
    }


def search_label(root: Path, needle: str) -> list[dict]:
    needle_l = needle.strip().lower()
    if not needle_l:
        return []
    map_path = root / "docs/agent-ui-map.md"
    results: list[dict] = []
    if map_path.is_file():
        for line in map_path.read_text(encoding="utf-8").splitlines():
            if "ontrack." not in line or needle_l not in line.lower():
                continue
            m = re.search(r"`(ontrack\.[^`]+)`", line)
            if not m:
                continue
            test_id = m.group(1)
            results.append({"testID": test_id, "mapLine": line.strip()})
    # Also scan current dump labels if present.
    try:
        sys.path.insert(0, str(root / "scripts/lib"))
        from agent_ui_bridge import paths as agent_ui_paths  # type: ignore

        dump_file, _status, _command = agent_ui_paths(root)
        if dump_file.is_file():
            data = json.loads(dump_file.read_text(encoding="utf-8"))
            for el in data.get("elements") or []:
                label = str(el.get("label") or "")
                tid = str(el.get("testID") or "")
                if needle_l in label.lower() or needle_l in tid.lower():
                    results.append(
                        {
                            "testID": tid,
                            "label": label or None,
                            "fromDump": True,
                        }
                    )
    except Exception:
        pass
    # Dedupe by testID preserving order.
    seen: set[str] = set()
    out: list[dict] = []
    for row in results:
        tid = row.get("testID") or ""
        if not tid or tid in seen:
            continue
        seen.add(tid)
        out.append(row)
    return out[:40]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if docs/agent-ui-sources.json is missing or stale",
    )
    parser.add_argument("--lookup", metavar="ID", help="Resolve one testID / key path")
    parser.add_argument(
        "--label", metavar="TEXT", help="Search agent-ui-map / dump labels"
    )
    parser.add_argument(
        "--json", action="store_true", help="Print machine JSON for lookup/label"
    )
    args = parser.parse_args(argv)
    root = repo_root()

    if args.lookup:
        row = lookup_id(root, args.lookup)
        if args.json:
            print(json.dumps(row, indent=2))
        else:
            assert row is not None
            print(row["testID"])
            if row.get("entry"):
                print(f"entry: {row['entry']}")
            if row.get("skill"):
                print(f"skill: {row['skill']}")
            for f in row.get("files") or []:
                print(f"file: {f}")
            if row.get("nearestStaticId") and row["nearestStaticId"] != row["testID"]:
                print(f"nearestStaticId: {row['nearestStaticId']}")
        return 0

    if args.label:
        rows = search_label(root, args.label)
        if args.json:
            print(json.dumps(rows, indent=2))
        else:
            if not rows:
                print("no matches", file=sys.stderr)
                return 1
            for row in rows:
                extra = row.get("label") or row.get("mapLine") or ""
                print(f"{row['testID']}\t{extra}")
        return 0 if rows else 1

    if args.check:
        path = sources_path(root)
        if not path.is_file():
            print("missing docs/agent-ui-sources.json", file=sys.stderr)
            return 1
        current = json.loads(path.read_text(encoding="utf-8"))
        fresh = build_index(root)
        # Compare without generatedAt.
        a = {k: v for k, v in current.items() if k != "generatedAt"}
        b = {k: v for k, v in fresh.items() if k != "generatedAt"}
        if a != b:
            print("docs/agent-ui-sources.json is stale — run npm run agent-ui:sources", file=sys.stderr)
            return 1
        print(f"ok ({fresh['idCount']} ids)")
        return 0

    payload = write_index(root)
    print(f"Wrote {sources_path(root)} ({payload['idCount']} ids)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
