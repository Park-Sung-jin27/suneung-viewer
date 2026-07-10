from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKUP_ROOT = ROOT / "backups"
KEEP_COUNT = 5


def iter_backup_files() -> list[Path]:
    files: list[Path] = []
    explicit = [
        ROOT / "index.html",
        ROOT / "extract_data.py",
        ROOT / "extract_trend.py",
    ]
    files.extend(path for path in explicit if path.exists())
    files.extend(sorted((ROOT / "js").glob("*.js")))
    files.extend(sorted((ROOT / "data").glob("*.json")))
    return files


def prune_old_backups() -> list[Path]:
    if not BACKUP_ROOT.exists():
        return []
    dirs = sorted(
        [path for path in BACKUP_ROOT.iterdir() if path.is_dir()],
        key=lambda path: path.name,
        reverse=True,
    )
    removed: list[Path] = []
    for old_dir in dirs[KEEP_COUNT:]:
        shutil.rmtree(old_dir)
        removed.append(old_dir)
    return removed


def main() -> int:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    target_root = BACKUP_ROOT / timestamp
    target_root.mkdir(parents=True, exist_ok=False)

    copied = 0
    total_bytes = 0
    for source in iter_backup_files():
        rel = source.relative_to(ROOT)
        target = target_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        copied += 1
        total_bytes += source.stat().st_size

    removed = prune_old_backups()
    mb = total_bytes / (1024 * 1024)
    print(f"Backup created: {target_root}")
    print(f"Files copied: {copied}")
    print(f"Total size: {mb:.2f} MB")
    if removed:
        print("Removed old backups:")
        for path in removed:
            print(f"- {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
