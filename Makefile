.PHONY: help install test test-watch test-coverage clean build lint format check

# Default target
help:
	@echo "TwinType Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install        Install dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  make test           Run all tests"
	@echo "  make test-watch     Run tests in watch mode"
	@echo "  make test-coverage  Run tests with coverage report"
	@echo ""
	@echo "Development:"
	@echo "  make clean          Remove generated files"
	@echo "  make build          Create extension package"
	@echo "  make check          Run all checks (tests)"
	@echo ""

# Installation
install:
	@echo "Installing dependencies..."
	npm install

# Testing
test:
	@echo "Running tests..."
	npm test

test-watch:
	@echo "Running tests in watch mode..."
	npm run test:watch

test-coverage:
	@echo "Running tests with coverage..."
	npm run test:coverage
	@echo ""
	@echo "Coverage report generated in coverage/"

# Cleanup
clean:
	@echo "Cleaning generated files..."
	rm -rf node_modules
	rm -rf coverage
	rm -f twintype.zip
	@echo "Clean complete"

# Build extension package
build:
	@echo "Building extension package..."
	@if [ -f twintype.zip ]; then rm twintype.zip; fi
	zip -r twintype.zip . \
		-x "node_modules/*" \
		-x "coverage/*" \
		-x ".git/*" \
		-x ".git" \
		-x "*.zip" \
		-x "__tests__/*" \
		-x "package.json" \
		-x "package-lock.json" \
		-x "Makefile" \
		-x "TEST.md" \
		-x "CLAUDE.md" \
		-x ".gitignore" \
		-x ".DS_Store" \
		-x ".claude/*" \
		-x "tasks/*" \
		-x "generate-icons.js"
	@echo "Extension package created: twintype.zip"
	@unzip -l twintype.zip | tail -1

# Run all checks
check: test
	@echo ""
	@echo "✓ All checks passed!"
