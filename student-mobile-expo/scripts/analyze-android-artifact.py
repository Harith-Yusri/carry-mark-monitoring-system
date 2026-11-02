"""Read an APK/AAB as a ZIP and report physical size and largest contributors.

Usage: python3 scripts/analyze-android-artifact.py /path/to/app.apk
No extraction, package modifications, or third-party dependencies required.
"""
import collections
import json
import os
import sys
import zipfile


def analyze(path):
    with zipfile.ZipFile(path) as archive:
        entries = [entry for entry in archive.infolist() if not entry.is_dir()]
        groups = collections.defaultdict(lambda: [0, 0])
        abis = collections.defaultdict(lambda: [0, 0])
        contributors = collections.defaultdict(lambda: [0, 0])
        for entry in entries:
            name = entry.filename
            parts = name.split("/")
            if "lib" in parts and name.endswith(".so"):
                category = "Native libraries"
                abi = parts[parts.index("lib") + 1]
                abis[abi][0] += entry.file_size
                abis[abi][1] += entry.compress_size
                contributor = "Native: " + parts[-1] + " (all ABIs)"
            elif name.endswith(".dex"):
                category = "DEX (Java/Kotlin code)"
                contributor = category
            elif name.endswith("resources.arsc") or "/res/" in name or name.startswith("res/"):
                category = "Android resources"
                contributor = category
            elif "/assets/" in name or name.startswith("assets/"):
                category = "Assets / bundled JavaScript"
                contributor = name
            else:
                category = "Manifest, metadata, other"
                contributor = category
            for target, key in [(groups, category), (contributors, contributor)]:
                target[key][0] += entry.file_size
                target[key][1] += entry.compress_size

        def summarize(values):
            return [dict(name=name, unpacked_bytes=size[0], stored_bytes=size[1])
                    for name, size in sorted(values.items(), key=lambda row: row[1][0], reverse=True)]

        return dict(
            artifact=os.path.abspath(path),
            file_bytes=os.path.getsize(path),
            unpacked_entry_bytes=sum(entry.file_size for entry in entries),
            stored_entry_bytes=sum(entry.compress_size for entry in entries),
            categories=summarize(groups),
            architectures=summarize(abis),
            top_10_contributors=summarize(contributors)[:10],
            largest_entries=[dict(name=entry.filename, unpacked_bytes=entry.file_size,
                                  stored_bytes=entry.compress_size)
                             for entry in sorted(entries, key=lambda item: item.file_size, reverse=True)[:15]],
            bundled_media_fonts=[entry.filename for entry in entries
                                 if entry.filename.lower().endswith((".mp4", ".mp3", ".wav", ".ttf", ".otf", ".gif"))],
            dev_related_paths=[entry.filename for entry in entries
                               if any(marker in entry.filename.lower()
                                      for marker in ("devlauncher", "devmenu", "hermestooling", "inspector"))],
        )


if __name__ == "__main__":
    print(json.dumps(analyze(sys.argv[1]), indent=2))
