#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
"""Build reproducible Character Audit Ledger release archives."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import time
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
MANIFEST = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
MODULE_ID = MANIFEST["id"]
VERSION = MANIFEST["version"]

INSTALLABLE_NAME = f"{MODULE_ID}-v{VERSION}-mod.zip"
SOURCE_NAME = f"{MODULE_ID}-v{VERSION}-src.zip"
DOCUMENTATION_NAME = f"{MODULE_ID}-v{VERSION}-doc.zip"

INSTALLABLE_PATHS = (
  "module.json",
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "scripts",
  "styles",
  "templates",
  "lang",
)

SOURCE_EXCLUDES = {
  "dist",
  "node_modules",
  "__pycache__",
  ".git",
}

DOCUMENTATION_PATHS = (
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "docs",
)


def source_epoch() -> int:
  raw = os.environ.get("SOURCE_DATE_EPOCH")
  if raw is not None:
    return max(int(raw), 315532800)  # ZIP timestamps cannot predate 1980.
  return int(time.mktime((2026, 8, 5, 18, 0, 0, 0, 0, -1)))


def zip_datetime(epoch: int) -> tuple[int, int, int, int, int, int]:
  value = time.gmtime(epoch)
  return (value.tm_year, value.tm_mon, value.tm_mday, value.tm_hour, value.tm_min, value.tm_sec)


def collect(paths: tuple[str, ...], *, source_mode: bool = False) -> list[Path]:
  files: list[Path] = []
  for relative in paths:
    target = ROOT / relative
    if target.is_file():
      files.append(target)
      continue
    for candidate in target.rglob("*"):
      if not candidate.is_file():
        continue
      relative_candidate = candidate.relative_to(ROOT)
      if source_mode and any(part in SOURCE_EXCLUDES for part in relative_candidate.parts):
        continue
      if candidate.suffix == ".pyc":
        continue
      files.append(candidate)
  return sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())


def collect_source() -> list[Path]:
  files: list[Path] = []
  for candidate in ROOT.rglob("*"):
    if not candidate.is_file():
      continue
    relative = candidate.relative_to(ROOT)
    if any(part in SOURCE_EXCLUDES for part in relative.parts):
      continue
    if candidate.suffix == ".pyc":
      continue
    files.append(candidate)
  return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def write_archive(destination: Path, files: list[Path], prefix: str, epoch: int, extras: dict[str, bytes] | None = None) -> None:
  timestamp = zip_datetime(epoch)
  with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
      relative = PurePosixPath(file.relative_to(ROOT).as_posix())
      arcname = PurePosixPath(prefix) / relative
      info = zipfile.ZipInfo(str(arcname), date_time=timestamp)
      info.compress_type = zipfile.ZIP_DEFLATED
      info.external_attr = (stat.S_IFREG | 0o644) << 16
      archive.writestr(info, file.read_bytes())
    for relative, content in sorted((extras or {}).items()):
      info = zipfile.ZipInfo(str(PurePosixPath(prefix) / relative), date_time=timestamp)
      info.compress_type = zipfile.ZIP_DEFLATED
      info.external_attr = (stat.S_IFREG | 0o644) << 16
      archive.writestr(info, content)


def sha256(path: Path) -> str:
  digest = hashlib.sha256()
  with path.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest()


def main() -> None:
  if DIST.exists():
    shutil.rmtree(DIST)
  DIST.mkdir(parents=True)
  epoch = source_epoch()

  installable = DIST / INSTALLABLE_NAME
  source = DIST / SOURCE_NAME
  documentation = DIST / DOCUMENTATION_NAME

  write_archive(installable, collect(INSTALLABLE_PATHS), MODULE_ID, epoch)
  write_archive(source, collect_source(), f"{MODULE_ID}-v{VERSION}-src", epoch)

  first_checksums = (
    f"{sha256(installable)}  {installable.name}\n"
    f"{sha256(source)}  {source.name}\n"
  ).encode("utf-8")
  write_archive(
    documentation,
    collect(DOCUMENTATION_PATHS),
    f"{MODULE_ID}-v{VERSION}-doc",
    epoch,
    extras={"ARTIFACT-SHA256SUMS.txt": first_checksums},
  )

  artifacts = (installable, source, documentation)
  checksum_text = "".join(f"{sha256(path)}  {path.name}\n" for path in artifacts)
  (DIST / f"{MODULE_ID}-v{VERSION}-SHA256SUMS.txt").write_text(checksum_text, encoding="utf-8")

  for path in artifacts:
    print(f"{path.name}: {path.stat().st_size} bytes")
  print("SHA256SUMS.txt created.")


if __name__ == "__main__":
  main()
