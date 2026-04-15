# quaesitor-textus — Claude Code Instructions

## Debug Tools

### Headless CSS/Layout Inspector

`scripts/inspect-element.py` uses Playwright to inspect DOM elements and take
screenshots without asking the user. Requires `make dev-tools` first (one-time setup).

```bash
# Full page screenshot (use 6006 for core-storybook, 6007 for antd-storybook)
.venv/bin/python scripts/inspect-element.py http://localhost:6006/ \
  "body" --full-screenshot /tmp/storybook.png

# Inspect the story canvas and its computed styles
.venv/bin/python scripts/inspect-element.py http://localhost:6006/ \
  "#storybook-root" --styles display,height,width,overflow

# Inspect with children
.venv/bin/python scripts/inspect-element.py http://localhost:6006/ \
  "#storybook-root" --children
```

**When debugging CSS/layout issues in Storybook, use this tool instead of asking
the user to screenshot and describe.** It returns computed styles, bounding boxes,
and can take element or full-page screenshots.

Note: Storybook stories render inside an iframe. To inspect story content, target
the iframe's inner document — use the `--wait` flag (default 2s) to allow JS to render.
