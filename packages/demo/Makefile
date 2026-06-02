.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help install build run-backend run-frontend mongo-up mongo-down seed clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	cd ../.. && pnpm install

build: ## Build the client bundle
	pnpm build

run-backend: ## Run the Fastify API (dev, cross-package HMR)
	pnpm dev:server

run-frontend: ## Run the Vite dev server (proxies /api -> backend)
	pnpm dev:client

mongo-up: ## Start single-node replica-set MongoDB on :27018
	$(COMPOSE) up -d
	@echo "Waiting for replica set to be ready..."
	@until docker compose exec -T mongo mongosh --quiet --eval "rs.status().ok" >/dev/null 2>&1; do sleep 2; done
	@echo "MongoDB replica set ready on :27018"

mongo-down: ## Stop MongoDB
	$(COMPOSE) down

seed: ## Seed the first 1000 books + create indexes
	pnpm seed

clean: ## Remove build artifacts, node_modules, caches
	rm -rf dist node_modules .vite
