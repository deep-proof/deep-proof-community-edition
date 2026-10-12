"""Validate and extract one text-based skill package without trusting ZIP paths."""
import os, sys, stat, zipfile, pathlib
source, target = sys.argv[1:]
with zipfile.ZipFile(source) as z:
    entries = z.infolist()
    if len(entries) > 2000 or sum(e.file_size for e in entries) > 100_000_000:
        raise ValueError('Skill archive exceeds extraction limits')
    names = set()
    for entry in entries:
        name = entry.filename
        if '\\' in name or ':' in name or name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts:
            raise ValueError('Unsafe path in skill archive')
        if name in names: raise ValueError('Duplicate path in skill archive')
        names.add(name)
        mode = entry.external_attr >> 16
        if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR): raise ValueError('Links and special files are not allowed')
        if entry.flag_bits & 1: raise ValueError('Encrypted skill archives are not supported')
        if entry.file_size > 10_000_000: raise ValueError('Skill file exceeds 10 MB')
    candidates = [e.filename for e in entries if e.filename.endswith('SKILL.md') and pathlib.PurePosixPath(e.filename).name == 'SKILL.md' and not e.filename.startswith('__MACOSX/')]
    if len(candidates) != 1: raise ValueError('ZIP must contain exactly one SKILL.md')
    root = str(pathlib.PurePosixPath(candidates[0]).parent)
    prefix = '' if root == '.' else root + '/'
    for entry in entries:
        name = entry.filename
        if entry.is_dir() or name.startswith('__MACOSX/') or pathlib.PurePosixPath(name).name == '.DS_Store': continue
        if not name.startswith(prefix): raise ValueError('Files outside the skill folder are not allowed')
        relative = name[len(prefix):]
        raw = z.read(entry)
        text = raw.decode('utf-8')
        if '\0' in text: raise ValueError('Skill packages must contain readable text and code files')
        destination = pathlib.Path(target, relative)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(raw)
