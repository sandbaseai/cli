.PHONY: build test vet lint clean snapshot install

VERSION ?= dev
LDFLAGS := -s -w -X github.com/sandbaseai/cli/cmd.Version=$(VERSION)

build:
	go build -ldflags "$(LDFLAGS)" -o sandbase .

test:
	go test ./... -count=1

vet:
	go vet ./...

lint: vet
	@echo "lint passed"

cover:
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | tail -1

clean:
	rm -f sandbase coverage.out
	rm -rf dist/

snapshot:
	goreleaser release --snapshot --clean

install: build
	cp sandbase /usr/local/bin/sandbase
