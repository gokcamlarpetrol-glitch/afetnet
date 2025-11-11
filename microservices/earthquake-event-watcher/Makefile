.PHONY: build test lint clean docker-build docker-run deploy help

help:
	@echo "Earthquake Event Watcher - Makefile Commands"
	@echo ""
	@echo "  make build          - Build TypeScript"
	@echo "  make test          - Run tests"
	@echo "  make lint          - Run linter"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-run    - Run Docker container"
	@echo "  make deploy        - Deploy to Kubernetes"

build:
	npm run build

test:
	npm test

lint:
	npm run lint

clean:
	rm -rf dist coverage node_modules

docker-build:
	docker build -t earthquake-event-watcher .

docker-run:
	docker run --env-file .env -p 3000:3000 -p 9090:9090 earthquake-event-watcher

deploy:
	./scripts/deploy.sh

