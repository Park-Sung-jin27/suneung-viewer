from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SIZES_FILE = ROOT / "sizes.json"

CHECKS = [
    ("index.html", b"</html>"),
    ("js/scenario_engine.js", b"INTEGRITY_MARKER_END_OF_FILE"),
    ("js/data.js", b";"),
    ("js/trend_data.js", b";"),
    ("js/susi_minreq.js", b";"),
    ("js/gyogwa_banyeong.js", b";"),
]

BLOCKED_DATA_PATTERNS = [
    '전형: "모집인원',
    '전형: "모집단위',
    '"전형": "모집인원',
    '"전형": "모집단위',
]


def tail_bytes(path: Path, limit: int = 2048) -> bytes:
    size = path.stat().st_size
    with path.open("rb") as f:
        if size > limit:
            f.seek(-limit, 2)
        return f.read()


def load_previous_sizes() -> dict[str, int]:
    if not SIZES_FILE.exists():
        return {}
    try:
        data = json.loads(SIZES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"FAIL sizes.json cannot be read: {exc}")
        sys.exit(1)
    return {str(k): int(v) for k, v in data.items()}


def save_sizes(sizes: dict[str, int]) -> None:
    SIZES_FILE.write_text(
        json.dumps(sizes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def check_data_contamination() -> list[str]:
    data_path = ROOT / "js" / "data.js"
    text = data_path.read_text(encoding="utf-8")
    return [
        f"js/data.js: polluted admission label found ({pattern})"
        for pattern in BLOCKED_DATA_PATTERNS
        if pattern in text
    ]


def main() -> int:
    previous = load_previous_sizes()
    current: dict[str, int] = {}
    failures: list[str] = []

    for rel_path, marker in CHECKS:
        path = ROOT / rel_path
        if not path.exists():
            failures.append(f"{rel_path}: missing")
            print(f"FAIL {rel_path}: missing")
            continue

        size = path.stat().st_size
        current[rel_path] = size

        tail = tail_bytes(path)
        if marker not in tail:
            failures.append(f"{rel_path}: end marker not found")
            print(f"FAIL {rel_path}: end marker not found")
            continue

        old_size = previous.get(rel_path)
        if old_size and size < old_size * 0.9:
            failures.append(
                f"{rel_path}: size dropped more than 10% ({old_size} -> {size})"
            )
            print(f"FAIL {rel_path}: size dropped more than 10% ({old_size} -> {size})")
            continue

        size_note = "baseline" if old_size is None else f"{old_size} -> {size}"
        print(f"OK   {rel_path}: {size} bytes ({size_note})")

    for failure in check_data_contamination():
        failures.append(failure)
        print(f"FAIL {failure}")

    if failures:
        print("")
        print("Integrity check failed. sizes.json was not updated.")
        return 1

    save_sizes(current)
    print("")
    print(f"All checks passed. Updated {SIZES_FILE.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
