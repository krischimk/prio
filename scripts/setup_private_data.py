#!/usr/bin/env python3
"""Link Prio's private Android signing data from the local Nextcloud folder."""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

def find_nextcloud_root() -> Path:
    configured = os.environ.get("NEXTCLOUD_ROOT")
    candidates = [
        Path(configured).expanduser() if configured else None,
        Path.home() / "Nextcloud",
        Path.home() / "Documents" / "Nextcloud",
        Path.home() / "Dokumente" / "Nextcloud",
    ]
    for candidate in candidates:
        if candidate is not None and candidate.is_dir():
            return candidate.resolve()
    raise SystemExit(
        "Nextcloud wurde nicht gefunden. Setze NEXTCLOUD_ROOT auf den lokalen Nextcloud-Ordner."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    link = Path.home() / ".prio-android"
    project_env = PROJECT_ROOT / ".env"
    target = (
        find_nextcloud_root()
        / "Dokumente"
        / "Codex-Projekte"
        / "Prio"
        / "Android-Signierung"
    )
    if args.check:
        required = (
            "prio-release.keystore",
            "ZUGANGSDATEN.txt",
            "emulator.env",
            "web.env",
        )
        if not link.is_symlink() or link.resolve() != target.resolve():
            raise SystemExit("Die private Prio-Verknüpfung fehlt oder zeigt auf den falschen Ordner.")
        missing = [name for name in required if not (target / name).is_file()]
        if missing:
            raise SystemExit("Private Dateien fehlen: " + ", ".join(missing))
        if (
            not project_env.is_symlink()
            or project_env.resolve() != (target / "web.env").resolve()
        ):
            raise SystemExit("Die lokale .env-Verknüpfung fehlt oder zeigt falsch.")
        print("Private Prio-Daten sind vollständig verknüpft.")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    if link.is_symlink():
        if link.resolve() == target.resolve():
            pass
        else:
            link.unlink()
    elif link.exists():
        if target.exists():
            raise SystemExit(f"Sowohl {link} als auch {target} existieren; nichts wurde verändert.")
        shutil.move(str(link), str(target))
    elif not target.exists():
        target.mkdir(parents=True, exist_ok=True)
    if not link.exists() and not link.is_symlink():
        link.symlink_to(target, target_is_directory=True)

    target_env = target / "web.env"
    if project_env.is_symlink():
        if project_env.resolve() != target_env.resolve():
            project_env.unlink()
    elif project_env.exists():
        if target_env.exists():
            raise SystemExit(f"Sowohl {project_env} als auch {target_env} existieren.")
        shutil.move(str(project_env), str(target_env))
    if not target_env.is_file():
        raise SystemExit(
            f"Lokale Web-Konfiguration fehlt. Erstelle {target_env} aus .env.example."
        )
    if not project_env.is_symlink():
        project_env.symlink_to(target_env)
    print(f"Private Prio-Daten liegen nun unter {target}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
