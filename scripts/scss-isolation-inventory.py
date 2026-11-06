#!/usr/bin/env python3
"""Which global SCSS classes could move into a CSS Module?

For every non-module `.scss` file under app/, lists how many of its class
selectors are
  iso     - referenced by exactly one source file and by no other stylesheet
            (safe to scope into that component's `*.module.scss`),
  unused  - referenced by no source file (dead, or built dynamically),
  shared  - referenced by several files or by other stylesheets (theme
            overrides, Foundation utilities, ...): these stay global.

Heuristic (token match on class names, so a class named like a common
identifier looks "shared"), meant to pick candidates, not to prove them:
verify a conversion by diffing computed styles of the affected routes
before/after in a real build (see docs/UI_MIGRATION_PLAN.md, section 7.5,
and scripts/smoke-boot.py).

    python3 scripts/scss-isolation-inventory.py
"""
import collections
import os
import re


def strip_comments(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(?m)^[ \t]*//[^\n]*", "", text)


def main():
    scss, src = [], []
    for directory, _, files in os.walk("app"):
        if "__tests__" in directory or "app/assets" in directory and not directory.startswith("app/assets/stylesheets"):
            continue
        for name in files:
            path = os.path.join(directory, name)
            if name.endswith(".scss") and not name.endswith(".module.scss"):
                scss.append(path)
            elif name.endswith((".js", ".jsx", ".ts", ".tsx")) and os.path.getsize(path) < 400000:
                src.append(path)

    token = re.compile(r"[A-Za-z_][\w-]*")
    used_in = collections.defaultdict(set)
    for path in src:
        with open(path, encoding="utf8", errors="ignore") as handle:
            for tok in set(token.findall(handle.read())):
                used_in[tok].add(path)

    class_re = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")
    file_classes = {}
    styled_in = collections.defaultdict(set)
    for path in scss:
        with open(path, encoding="utf8", errors="ignore") as handle:
            text = re.sub(r"url\([^)]*\)", "", strip_comments(handle.read()))
        file_classes[path] = set(class_re.findall(text))
        for cls in file_classes[path]:
            styled_in[cls].add(path)

    print("%-58s %4s %5s %6s %6s  single-user components" % ("scss", "cls", "iso", "unused", "shared"))
    for path in sorted(scss):
        classes = file_classes[path]
        if not classes:
            continue
        iso = [c for c in classes if len(used_in.get(c, ())) == 1 and len(styled_in[c]) == 1]
        unused = [c for c in classes if not used_in.get(c) and len(styled_in[c]) == 1]
        shared = [c for c in classes if len(styled_in[c]) > 1 or len(used_in.get(c, ())) > 1]
        users = sorted({os.path.basename(next(iter(used_in[c]))) for c in iso})
        print("%-58s %4d %5d %6d %6d  %s" % (path.replace("app/assets/stylesheets/", ""), len(classes), len(iso), len(unused), len(shared), ",".join(users)[:60]))


if __name__ == "__main__":
    main()
