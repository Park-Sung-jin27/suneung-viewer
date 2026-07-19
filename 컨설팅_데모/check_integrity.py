from __future__ import annotations

import json
import re
import sys
import unicodedata
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


def check_susi_text_quality() -> list[str]:
    data_path = ROOT / "data" / "susi_cutoffs.json"
    if not data_path.exists():
        return []

    try:
        rows = json.loads(data_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return [f"data/susi_cutoffs.json: cannot be read ({exc})"]

    failures: list[str] = []
    for idx, row in enumerate(rows, start=1):
        for field in ("minreq", "minreq_note"):
            value = row.get(field)
            if isinstance(value, str) and "?" in value:
                univ = row.get("univ", "")
                dept = row.get("dept", "")
                failures.append(
                    f"data/susi_cutoffs.json:{idx}: question mark in {field} ({univ} / {dept})"
                )
    return failures


def check_susi_source_links() -> tuple[list[str], dict[str, int]]:
    data_path = ROOT / "data" / "susi_cutoffs.json"
    try:
        rows = json.loads(data_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return [f"data/susi_cutoffs.json: cannot be read ({exc})"], {}

    failures: list[str] = []
    stats = {
        "source_url_present": 0,
        "legacy_v0_8_unverified": 0,
        "known_malformed_held": 0,
    }
    expected_malformed_busan = {
        ("사회체육전공", "기초생활수급자 및 차상위계층전형"),
        ("사회체육전공", "농어촌학생전형"),
        ("스포츠재활전공", "기초생활수급자 및 차상위계층전형"),
        ("스포츠재활전공", "농어촌학생전형"),
        ("항공서비스전공", "기초생활수급자 및 차상위계층전형"),
        ("항공서비스전공", "농어촌학생전형"),
    }
    observed_malformed_busan: set[tuple[str, str]] = set()
    official_normalized_keys: set[tuple[object, ...]] = set()

    def normalize_identity(value: object) -> str:
        text = unicodedata.normalize("NFKC", str(value or "")).replace("전형", "")
        return re.sub(r"[^0-9A-Za-z가-힣]", "", text)

    def number(value: object) -> float | None:
        try:
            return float(str(value).replace(": 1", "").strip())
        except (TypeError, ValueError):
            return None

    def normalized_key(row: dict[str, object]) -> tuple[object, ...]:
        return (
            normalize_identity(row.get("univ")),
            normalize_identity(row.get("dept")),
            normalize_identity(row.get("전형")),
            number(row.get("capacity")),
            number(row.get("competition")),
            number(row.get("cut70_grade")),
        )

    for row in rows:
        if row.get("source_url"):
            official_normalized_keys.add(normalized_key(row))

    for idx, row in enumerate(rows, start=1):
        source = str(row.get("source") or "")
        source_url = str(row.get("source_url") or "")
        if source_url:
            stats["source_url_present"] += 1
        elif source == "v0.8_수시":
            stats["legacy_v0_8_unverified"] += 1
            malformed_key = (str(row.get("dept") or ""), str(row.get("전형") or ""))
            if (
                row.get("univ") == "부산외국어대학교"
                and malformed_key in expected_malformed_busan
                and number(row.get("competition")) is not None
                and number(row.get("competition")) >= 900
                and row.get("verification_status")
                == "EXCLUDED_MALFORMED_SOURCE_COLUMNS"
                and row.get("exclusion_reason")
            ):
                observed_malformed_busan.add(malformed_key)
                stats["known_malformed_held"] += 1
            else:
                failures.append(
                    f"data/susi_cutoffs.json:{idx}: unexpected unverified cutoff row"
                )
        else:
            failures.append(
                f"data/susi_cutoffs.json:{idx}: cutoff source_url missing ({source})"
            )

        adiga_match = re.fullmatch(r"adiga_(20\d{2})", source)
        if not adiga_match:
            if (
                source == "v0.8_수시"
                and not source_url
                and normalized_key(row) in official_normalized_keys
            ):
                failures.append(
                    f"data/susi_cutoffs.json:{idx}: normalized legacy duplicate remains"
                )
        else:
            expected_year = int(adiga_match.group(1)) + 1
            expected_fragment = f"searchSyr={expected_year}"
            if (
                "adiga.kr/" not in source_url
                or expected_fragment not in source_url
                or not re.search(r"[?&]unvCd=\d{7}(?:&|$)", source_url)
            ):
                failures.append(
                    f"data/susi_cutoffs.json:{idx}: invalid ADIGA source_url ({source})"
                )
    if observed_malformed_busan != expected_malformed_busan:
        failures.append(
            "data/susi_cutoffs.json: malformed Busan hold set does not match baseline"
        )
    return failures, stats


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

    for failure in check_susi_text_quality():
        failures.append(failure)
        print(f"FAIL {failure}")

    source_failures, source_stats = check_susi_source_links()
    for failure in source_failures:
        failures.append(failure)
        print(f"FAIL {failure}")
    if source_stats:
        print(
            "INFO cutoff source links: "
            f"present={source_stats['source_url_present']}, "
            f"legacy_v0_8_unverified={source_stats['legacy_v0_8_unverified']}, "
            f"known_malformed_held={source_stats['known_malformed_held']}"
        )

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
