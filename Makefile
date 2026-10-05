GO_VERSION=$(shell grep "^go " go.mod | cut -f 2 -d ' ')
NODE_VERSION=$(shell cat .nvmrc)

comma:=,
GO_BUILD_TAGS=netgo,sqlite_fts5$(if $(EXTRA_BUILD_TAGS),$(comma)$(EXTRA_BUILD_TAGS))

# Set global environment variables, required for most targets
export BR_ENABLEINSIGHTSCOLLECTOR=false

ifneq ("$(wildcard .git/HEAD)","")
GIT_SHA=$(shell git rev-parse --short HEAD)
GIT_TAG=$(shell git describe --tags --abbrev=0 2>/dev/null || echo v0.0.0)-SNAPSHOT
else
GIT_SHA=source_archive
GIT_TAG=$(patsubst navidrome-%,v%,$(notdir $(PWD)))-SNAPSHOT
endif

GOLANGCI_LINT_VERSION ?= v2.12.0

UI_SRC_FILES := $(shell find ui -type f -not -path "ui/build/*" -not -path "ui/node_modules/*")

setup: check_env download-deps install-golangci-lint setup-git ##@1_Run_First Install dependencies and prepare development environment
	@echo Downloading Node dependencies...
	@(cd ./ui && npm ci)
.PHONY: setup

dev: check_env   ##@Development Start Navidrome in development mode, with hot-reload for both frontend and backend
	npx foreman -j Procfile.dev -p 4533 start
.PHONY: dev

server: check_go_env buildjs ##@Development Start the backend in development mode
	go tool reflex -d none -c reflex.conf
.PHONY: server

stop: ##@Development Stop development servers (UI and backend)
	@echo "Stopping development servers..."
	@-pkill -f "vite"
	@-pkill -f "go tool reflex.*reflex.conf"
	@-pkill -f "go run.*netgo"
	@echo "Development servers stopped."
.PHONY: stop

watch: ##@Development Start Go tests in watch mode (re-run when code changes)
	go tool ginkgo watch -tags=$(GO_BUILD_TAGS) -notify ./...
.PHONY: watch

PKG ?= ./...
test: ##@Development Run Go tests. Use PKG variable to specify packages to test, e.g. make test PKG=./server
	go test -tags $(GO_BUILD_TAGS) $(PKG)
.PHONY: test

testall: test test-i18n test-js ##@Development Run Go and JS tests
.PHONY: testall

test-race: ##@Development Run Go tests with race detector
	go test -tags $(GO_BUILD_TAGS) -race -shuffle=on  $(PKG)
.PHONY: test-race

test-js: ##@Development Run JS tests
	@(cd ./ui && npm run test)
.PHONY: test-js

test-i18n: ##@Development Validate all translations files
	./.github/workflows/validate-translations.sh 
.PHONY: test-i18n

install-golangci-lint: ##@Development Install golangci-lint if not present
	@INSTALL=false; \
	if PATH=./bin:$$PATH which golangci-lint > /dev/null 2>&1; then \
		CURRENT_VERSION=$$(PATH=./bin:$$PATH golangci-lint version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1); \
		REQUIRED_VERSION=$$(echo "$(GOLANGCI_LINT_VERSION)" | sed 's/^v//'); \
		if [ "$$CURRENT_VERSION" != "$$REQUIRED_VERSION" ]; then \
			echo "Found golangci-lint $$CURRENT_VERSION, but $$REQUIRED_VERSION is required. Reinstalling..."; \
			rm -f ./bin/golangci-lint; \
			INSTALL=true; \
		fi; \
	else \
		INSTALL=true; \
	fi; \
	if [ "$$INSTALL" = "true" ]; then \
		echo "Installing golangci-lint $(GOLANGCI_LINT_VERSION)..."; \
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | sh -s $(GOLANGCI_LINT_VERSION); \
	fi
.PHONY: install-golangci-lint

lint: install-golangci-lint ##@Development Lint Go code
	PATH=./bin:$$PATH golangci-lint run --timeout 5m
.PHONY: lint

lintall: lint ##@Development Lint Go and JS code
	@(cd ./ui && npm run check-formatting) || (echo "\n\nPlease run 'npm run prettier' to fix formatting issues." && exit 1)
	@(cd ./ui && npm run lint)
.PHONY: lintall

format: ##@Development Format code
	@(cd ./ui && npm run prettier)
	@go tool goimports -w `find . -name '*.go' | grep -v _gen.go$$ | grep -v .pb.go$$`
	@go mod tidy
.PHONY: format

wire: check_go_env ##@Development Update Dependency Injection
	go tool wire gen -tags="$$(echo '$(GO_BUILD_TAGS)' | tr ',' ' ')" ./...
.PHONY: wire

gen: check_go_env ##@Development Run go generate for code generation
	go generate ./...
.PHONY: gen

snapshots: ##@Development Update (GoLang) Snapshot tests
	UPDATE_SNAPSHOTS=true go tool ginkgo ./server/subsonic/responses/...
.PHONY: snapshots

migration-sql: ##@Development Create an empty SQL migration file
	@if [ -z "${name}" ]; then echo "Usage: make migration-sql name=name_of_migration_file"; exit 1; fi
	go run github.com/pressly/goose/v3/cmd/goose@latest -dir db/migrations create ${name} sql
.PHONY: migration

migration-go: ##@Development Create an empty Go migration file
	@if [ -z "${name}" ]; then echo "Usage: make migration-go name=name_of_migration_file"; exit 1; fi
	go run github.com/pressly/goose/v3/cmd/goose@latest -dir db/migrations create ${name}
.PHONY: migration

setup-dev: setup
.PHONY: setup-dev

setup-git: ##@Development Setup Git hooks (pre-commit and pre-push)
	@echo Setting up git hooks
	@mkdir -p .git/hooks
	@(cd .git/hooks && ln -sf ../../git/* .)
.PHONY: setup-git

build: check_go_env buildjs ##@Build Build the project
	go build -ldflags="-X github.com/navidrome/navidrome/consts.gitSha=$(GIT_SHA) -X github.com/navidrome/navidrome/consts.gitTag=$(GIT_TAG)" -tags=$(GO_BUILD_TAGS)
.PHONY: build

buildall: deprecated build
.PHONY: buildall

debug-build: check_go_env buildjs ##@Build Build the project (with remote debug on)
	go build -gcflags="all=-N -l" -ldflags="-X github.com/navidrome/navidrome/consts.gitSha=$(GIT_SHA) -X github.com/navidrome/navidrome/consts.gitTag=$(GIT_TAG)" -tags=$(GO_BUILD_TAGS)
.PHONY: debug-build

buildjs: check_node_env ui/build/index.html ##@Build Build only frontend
.PHONY: buildjs

ui/build/index.html: $(UI_SRC_FILES)
	@(cd ./ui && npm run build)

##########################################
#### Worktrees

WORKTREES_DIR := .worktrees

wt: check_go_env ##@Worktrees Create and setup a git worktree. Usage: make wt name=feature-name [go=1]
	@if [ -z "${name}" ]; then echo "Usage: make wt name=<branch-name> [go=1]"; exit 1; fi
	@mkdir -p $(WORKTREES_DIR)
	@echo "Creating worktree for branch '${name}'..."
	@git worktree add $(WORKTREES_DIR)/${name} -b ${name} 2>/dev/null || \
		git worktree add $(WORKTREES_DIR)/${name} ${name}
	@if [ -n "${go}" ]; then \
		./scripts/setup-worktree.sh $(WORKTREES_DIR)/${name} --go-only; \
	else \
		./scripts/setup-worktree.sh $(WORKTREES_DIR)/${name}; \
	fi
	@echo "\nWorktree ready at $(WORKTREES_DIR)/${name}"
	@echo "  cd $(WORKTREES_DIR)/${name}"
.PHONY: wt

rm-wt: ##@Worktrees Remove a git worktree. Usage: make rm-wt name=feature-name
	@if [ -z "${name}" ]; then echo "Usage: make rm-wt name=<branch-name>"; exit 1; fi
	@if [ ! -d "$(WORKTREES_DIR)/${name}" ]; then echo "Worktree '${name}' not found in $(WORKTREES_DIR)/"; exit 1; fi
	@echo "Removing worktree '${name}'..."
	@git worktree remove --force $(WORKTREES_DIR)/${name}
	@echo "Worktree '${name}' removed."
	@echo "Note: branch '${name}' still exists. Delete it with: git branch -D ${name}"
.PHONY: rm-wt

ls-wt: ##@Worktrees List all active git worktrees
	@git worktree list
.PHONY: ls-wt

##########################################
#### Miscellaneous

clean:
	@rm -rf ./dist ./ui/build/*
	@touch ./ui/build/.gitkeep
.PHONY: clean

download-deps:
	@echo Downloading Go dependencies...
	@go mod download
	@go mod tidy # To revert any changes made by the `go mod download` command
.PHONY: download-deps

check_env: check_go_env check_node_env
.PHONY: check_env

check_go_env:
	@(hash go) || (echo "\nERROR: GO environment not setup properly!\n"; exit 1)
	@current_go_version=`go version | cut -d ' ' -f 3 | cut -c3-` && \
		echo "$(GO_VERSION) $$current_go_version" | \
		tr ' ' '\n' | sort -V | tail -1 | \
		grep -q "^$${current_go_version}$$" || \
		(echo "\nERROR: Please upgrade your GO version\nThis project requires at least the version $(GO_VERSION)"; exit 1)
.PHONY: check_go_env

check_node_env:
	@(hash node) || (echo "\nERROR: Node environment not setup properly!\n"; exit 1)
	@current_node_version=`node --version` && \
		echo "$(NODE_VERSION) $$current_node_version" | \
		tr ' ' '\n' | sort -V | tail -1 | \
		grep -q "^$${current_node_version}$$" || \
		(echo "\nERROR: Please check your Node version. Should be at least $(NODE_VERSION)\n"; exit 1)
.PHONY: check_node_env

pre-push: lintall testall
.PHONY: pre-push

deprecated:
	@echo "WARNING: This target is deprecated and will be removed in future releases. Use 'make build' instead."
.PHONY: deprecated

.DEFAULT_GOAL := help

HELP_FUN = \
	%help; while(<>){push@{$$help{$$2//'options'}},[$$1,$$3] \
	if/^([\w-_]+)\s*:.*\#\#(?:@(\w+))?\s(.*)$$/}; \
	print"$$_:\n", map"  $$_->[0]".(" "x(20-length($$_->[0])))."$$_->[1]\n",\
	@{$$help{$$_}},"\n" for sort keys %help; \

help: ##@Miscellaneous Show this help
	@echo "Usage: make [target] ...\n"
	@perl -e '$(HELP_FUN)' $(MAKEFILE_LIST)
