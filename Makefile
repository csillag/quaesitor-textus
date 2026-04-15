.PHONY: help install storybook build

help:
	@echo "Available targets:"
	@echo "  install    Install all dependencies (pnpm install)"
	@echo "  storybook  Launch Storybook dev server on http://localhost:6006"
	@echo "  build      Build all packages"

install:
	pnpm install

storybook:
	pnpm --filter @quaesitor-textus/core storybook

build:
	pnpm -r build
