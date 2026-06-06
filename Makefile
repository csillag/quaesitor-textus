.PHONY: help install core-storybook antd-storybook build dev-tools publish publish-core publish-antd publish-mongo _release publish-patch-version publish-minor-version publish-major-version

VENV := .venv
PIP  := $(VENV)/bin/pip

help:
	@echo "Available targets:"
	@echo "  install          Install all dependencies (pnpm install)"
	@echo "  core-storybook   Launch core Storybook dev server on http://localhost:6006"
	@echo "  antd-storybook   Launch antd Storybook dev server on http://localhost:6007"
	@echo "  build            Build all packages"
	@echo "  publish          Build and publish all three packages to npmjs"
	@echo "  publish-core          Build and publish @quaesitor-textus/core to npmjs"
	@echo "  publish-antd          Build and publish @quaesitor-textus/antd to npmjs"
	@echo "  publish-mongo         Build and publish @quaesitor-textus/mongo to npmjs"
	@echo "  publish-patch-version Bump patch version of all packages, publish, tag and push"
	@echo "  publish-minor-version Bump minor version of all packages, publish, tag and push"
	@echo "  publish-major-version Bump major version of all packages, publish, tag and push"
	@echo "  dev-tools             Install debug tools (Playwright headless browser)"

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

publish-mongo:
	pnpm --filter @quaesitor-textus/mongo build
	pnpm --filter @quaesitor-textus/mongo publish --no-git-checks

publish: publish-core publish-antd publish-mongo

# Bump every published package in lockstep, commit, publish, then tag and push.
# Invoked by the publish-{patch,minor,major}-version targets via BUMP.
_release:
	cd packages/core && npm version $(BUMP) --no-git-tag-version
	cd packages/antd && npm version $(BUMP) --no-git-tag-version
	cd packages/mongo && npm version $(BUMP) --no-git-tag-version
	git add packages/core/package.json packages/antd/package.json packages/mongo/package.json
	VERSION=$$(node -p "require('./packages/core/package.json').version") && git commit -m "chore: release v$$VERSION"
	$(MAKE) publish
	VERSION=$$(node -p "require('./packages/core/package.json').version") && \
		git tag -a v$$VERSION -m "v$$VERSION" && \
		git push origin HEAD && \
		git push origin v$$VERSION

publish-patch-version: BUMP=patch
publish-patch-version: _release

publish-minor-version: BUMP=minor
publish-minor-version: _release

publish-major-version: BUMP=major
publish-major-version: _release

dev-tools: $(VENV)/bin/activate
	$(PIP) install playwright
	$(VENV)/bin/playwright install chromium
