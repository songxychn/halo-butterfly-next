# Butterfly Icons subsets

These three WOFF2 files are modified subsets of Font Awesome Free 6.7.2,
Copyright (c) 2024 Fonticons, Inc., licensed under SIL Open Font License 1.1.
The complete license is distributed as `LICENSE.txt` beside this notice in
the built theme's `plugins/fontawesome` directory. Source:
https://github.com/FortAwesome/Font-Awesome/tree/6.7.2/webfonts

The font families and identifying metadata are renamed to Butterfly Icons;
the reserved Font Awesome name identifies only the original fallback fonts.
The subsets retain outlines, metrics and hinting of selected glyphs. Original
full fonts and CSS, including Font Awesome 4/5 compatibility aliases, remain
available. Two faces within each new CSS family select the small subset or
the remaining original character coverage; any icon outside the subset uses
the original full font. This avoids eagerly downloading a second font family
for line metrics. Original global bounds are retained, and the small face's
CSS coverage includes U+20 to preserve line-box positioning without inventing
a space glyph. This follows CSS Fonts 4's [first available font selection](https://www.w3.org/TR/css-fonts-4/#font-style-matching): U+0020 must be included in `unicode-range`, but an actual space glyph is not required. If a
subset fails to download or decode, its `src` list uses the original WOFF2,
then the original TTF, preserving upstream's final fallback format.
`font-display:block` remains unchanged to avoid showing missing-glyph boxes.

Regenerate only when changing the pinned Font Awesome version or expanding
the small set of statically used theme icons. A new icon still works through
the full fallback without regeneration. From the repository root, run:

```sh
python3 -m venv /tmp/butterfly-font-tools
/tmp/butterfly-font-tools/bin/pip install fonttools==4.60.1 brotli==1.1.0
/tmp/butterfly-font-tools/bin/python scripts/fonts/generate-subsets.py
```

The generator scans theme source and setting defaults, resolves aliases using
upstream metadata, intersects each font's own character map, preserves license
metadata and disables timestamp rewriting. `manifest.json` records original
and generated hashes. Normal `bun run build` verifies these files and copies
them; Python font tooling is not required for normal development or CI.
