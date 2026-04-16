.PHONY: help install core-storybook antd-storybook build dev-tools publish publish-core publish-antd

VENV := .venv
PIP  := $(VENV)/bin/pip

help:
	@echo "Available targets:"
	@echo "  install          Install all dependencies (pnpm install)"
	@echo "  core-storybook   Launch core Storybook dev server on http://localhost:6006"
	@echo "  antd-storybook   Launch antd Storybook dev server on http://localhost:6007"
	@echo "  build            Build all packages"
	@echo "  publish          Build and publish both packages to npmjs"
	@echo "  publish-core     Build and publish @quaesitor-textus/core to npmjs"
	@echo "  publish-antd     Build and publish @quaesitor-textus/antd to npmjs"
	@echo "  dev-tools        Install debug tools (Playwright headless browser)"

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip

install:
	pnpm install

core-storybook:
	pnpm --filter @quaesitor-textus/core storybook

antd-storybook:
	pnpm --filter @quaesitor-textus/antd storybook

build:
	pnpm -r build

publish-core:
	pnpm --filter @quaesitor-textus/core build
	pnpm --filter @quaesitor-textus/core publish --no-git-checks

publish-antd: publish-core
	pnpm --filter @quaesitor-textus/antd build
	pnpm --filter @quaesitor-textus/antd publish --no-git-checks

publish: publish-core publish-antd

dev-tools: $(VENV)/bin/activate
	$(PIP) install playwright
	$(VENV)/bin/playwright install chromium
