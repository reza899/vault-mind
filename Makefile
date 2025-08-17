# Vault Mind - Development Makefile
# 
# This Makefile provides convenient commands for development, testing, and deployment.
# Use 'make help' to see all available commands.

.PHONY: help install test lint format clean dev prod stop logs health build deploy

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

help: ## Show this help message
	@echo "$(BLUE)Vault Mind - Available Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make dev           # Start development environment"
	@echo "  make test          # Run all tests"
	@echo "  make lint          # Check code quality"
	@echo "  make claude-status # Check Claude Code integration"
	@echo "  make clean         # Clean up containers and volumes"

# Installation
install: install-claude-commands ## Install all dependencies (backend + frontend + Claude commands)
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	@echo "$(YELLOW)Installing backend dependencies...$(RESET)"
	cd backend && pip install -r requirements.txt
	@echo "$(YELLOW)Installing frontend dependencies...$(RESET)"
	cd frontend && npm install
	@echo "$(GREEN)✅ All dependencies installed$(RESET)"

install-claude-commands: ## Install Claude Code slash commands
	@echo "$(BLUE)Installing Claude Code slash commands...$(RESET)"
	@if [ ! -d "$$HOME/.claude/commands" ]; then \
		echo "$(YELLOW)Creating global Claude commands directory...$(RESET)"; \
		mkdir -p "$$HOME/.claude/commands"; \
	fi
	@if [ -f "claude-vault-command.md" ]; then \
		echo "$(YELLOW)Installing vault command from root directory...$(RESET)"; \
		cp claude-vault-command.md "$$HOME/.claude/commands/vault.md"; \
		echo "$(GREEN)✅ Claude Code slash command installed$(RESET)"; \
	else \
		echo "$(RED)⚠️  claude-vault-command.md not found in root directory$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)📝 Note: Restart Claude Code to load new commands$(RESET)"

install-backend: ## Install backend dependencies only
	@echo "$(BLUE)Installing backend dependencies...$(RESET)"
	cd backend && pip install -r requirements.txt
	@echo "$(GREEN)✅ Backend dependencies installed$(RESET)"

install-frontend: ## Install frontend dependencies only
	@echo "$(BLUE)Installing frontend dependencies...$(RESET)"
	cd frontend && npm install
	@echo "$(GREEN)✅ Frontend dependencies installed$(RESET)"

# Testing
test: ## Run all tests with coverage
	@echo "$(BLUE)Running all tests...$(RESET)"
	@echo "$(YELLOW)Running backend tests...$(RESET)"
	cd backend && pytest --cov --cov-report=term-missing
	@echo "$(YELLOW)Running frontend tests...$(RESET)"
	cd frontend && npm run test:run
	@echo "$(GREEN)✅ All tests completed$(RESET)"

test-backend: ## Run backend tests only
	@echo "$(BLUE)Running backend tests...$(RESET)"
	cd backend && pytest --cov --cov-report=term-missing

test-frontend: ## Run frontend tests only
	@echo "$(BLUE)Running frontend tests...$(RESET)"
	cd frontend && npm run test:run

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(RESET)"
	cd frontend && npm run test

# Code Quality
lint: ## Check code quality (all)
	@echo "$(BLUE)Checking code quality...$(RESET)"
	@echo "$(YELLOW)Linting backend...$(RESET)"
	cd backend && ruff check .
	@echo "$(YELLOW)Linting frontend...$(RESET)"
	cd frontend && npm run lint
	@echo "$(YELLOW)Type checking frontend...$(RESET)"
	cd frontend && npm run typecheck
	@echo "$(GREEN)✅ All linting completed$(RESET)"

lint-backend: ## Lint backend code only
	@echo "$(BLUE)Linting backend...$(RESET)"
	cd backend && ruff check .

lint-frontend: ## Lint frontend code only
	@echo "$(BLUE)Linting frontend...$(RESET)"
	cd frontend && npm run lint && npm run typecheck

format: ## Auto-format all code
	@echo "$(BLUE)Formatting code...$(RESET)"
	@echo "$(YELLOW)Formatting backend...$(RESET)"
	cd backend && ruff format .
	@echo "$(YELLOW)Formatting frontend...$(RESET)"
	cd frontend && npm run format
	@echo "$(GREEN)✅ All code formatted$(RESET)"

format-backend: ## Format backend code only
	@echo "$(BLUE)Formatting backend...$(RESET)"
	cd backend && ruff format .

format-frontend: ## Format frontend code only
	@echo "$(BLUE)Formatting frontend...$(RESET)"
	cd frontend && npm run format

# Development
dev: ## Start development environment with Docker
	@echo "$(BLUE)Starting development environment...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)✅ Development environment started$(RESET)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(RESET)"
	@echo "$(YELLOW)Backend API: http://localhost:8000$(RESET)"
	@echo "$(YELLOW)API Docs: http://localhost:8000/docs$(RESET)"

dev-local: ## Start development servers locally (without Docker)
	@echo "$(BLUE)Starting local development servers...$(RESET)"
	@echo "$(YELLOW)Starting backend server...$(RESET)"
	cd backend && uvicorn app:app --reload --port 8000 &
	@echo "$(YELLOW)Starting frontend server...$(RESET)"
	cd frontend && npm run dev

stop: ## Stop all running containers
	@echo "$(BLUE)Stopping containers...$(RESET)"
	docker-compose down
	@echo "$(GREEN)✅ All containers stopped$(RESET)"

restart: ## Restart development environment
	@echo "$(BLUE)Restarting development environment...$(RESET)"
	docker-compose down
	docker-compose up -d
	@echo "$(GREEN)✅ Development environment restarted$(RESET)"

logs: ## View logs from all services
	@echo "$(BLUE)Viewing logs...$(RESET)"
	docker-compose logs -f

logs-backend: ## View backend logs only
	@echo "$(BLUE)Viewing backend logs...$(RESET)"
	docker-compose logs -f backend

logs-frontend: ## View frontend logs only
	@echo "$(BLUE)Viewing frontend logs...$(RESET)"
	docker-compose logs -f frontend

# Health & Status
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(RESET)"
	@echo "$(YELLOW)Backend health:$(RESET)"
	curl -f http://localhost:8000/health || echo "$(RED)❌ Backend unhealthy$(RESET)"
	@echo "$(YELLOW)Frontend health:$(RESET)"
	curl -f http://localhost:5173 || echo "$(RED)❌ Frontend unhealthy$(RESET)"

status: ## Show status of Docker containers
	@echo "$(BLUE)Container status:$(RESET)"
	docker-compose ps

# Building & Production
build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(RESET)"
	docker-compose build
	@echo "$(GREEN)✅ All images built$(RESET)"

build-frontend: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(RESET)"
	cd frontend && npm run build
	@echo "$(GREEN)✅ Frontend built$(RESET)"

prod: ## Start production environment
	@echo "$(BLUE)Starting production environment...$(RESET)"
	docker-compose up --build -d
	@echo "$(GREEN)✅ Production environment started$(RESET)"

# Database & Cleanup
clean: ## Clean up containers, volumes, and build artifacts
	@echo "$(BLUE)Cleaning up...$(RESET)"
	docker-compose down -v
	docker system prune -f
	@echo "$(YELLOW)Cleaning frontend build...$(RESET)"
	cd frontend && rm -rf dist node_modules/.vite
	@echo "$(YELLOW)Cleaning Python cache...$(RESET)"
	find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find backend -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "$(GREEN)✅ Cleanup completed$(RESET)"

clean-data: ## Clean ChromaDB data (⚠️  WARNING: This deletes all indexed data!)
	@echo "$(RED)⚠️  WARNING: This will delete all indexed vault data!$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(BLUE)Cleaning ChromaDB data...$(RESET)"
	docker-compose down
	docker volume rm vault-mind_backend_chroma_data 2>/dev/null || true
	rm -rf ./backend/chroma_db 2>/dev/null || true
	@echo "$(GREEN)✅ ChromaDB data cleaned$(RESET)"

reset: clean clean-data ## Full reset (clean + remove all data)
	@echo "$(GREEN)✅ Full reset completed$(RESET)"

# Security & Quality Assurance
security: ## Run security checks
	@echo "$(BLUE)Running security checks...$(RESET)"
	@echo "$(YELLOW)Checking Python dependencies...$(RESET)"
	cd backend && pip-audit || echo "$(YELLOW)⚠️  pip-audit not installed (pip install pip-audit)$(RESET)"
	@echo "$(YELLOW)Checking Node.js dependencies...$(RESET)"
	cd frontend && npm audit || echo "$(YELLOW)⚠️  npm audit found issues$(RESET)"

deps-update: ## Update all dependencies
	@echo "$(BLUE)Updating dependencies...$(RESET)"
	@echo "$(YELLOW)Updating backend dependencies...$(RESET)"
	cd backend && pip list --outdated
	@echo "$(YELLOW)Updating frontend dependencies...$(RESET)"
	cd frontend && npm update
	@echo "$(GREEN)✅ Dependencies updated$(RESET)"

# Documentation
docs: ## Generate/update documentation
	@echo "$(BLUE)Generating documentation...$(RESET)"
	@echo "$(YELLOW)API documentation available at: http://localhost:8000/docs$(RESET)"
	@echo "$(YELLOW)ReDoc documentation available at: http://localhost:8000/redoc$(RESET)"

# Quick commands
quick-start: install dev ## Quick start for new developers
	@echo "$(GREEN)🚀 Quick start completed!$(RESET)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(RESET)"
	@echo "$(YELLOW)Backend API: http://localhost:8000/docs$(RESET)"
	@echo "$(BLUE)Claude Code Integration:$(RESET)"
	@echo "$(YELLOW)  • Slash commands installed to: ~/.claude/commands$(RESET)"
	@echo "$(YELLOW)  • Usage: /vault collection_name your query here$(RESET)"
	@echo "$(YELLOW)  • Restart Claude Code to load new commands$(RESET)"

ci: lint test ## Run CI checks locally
	@echo "$(GREEN)✅ CI checks completed$(RESET)"

# Development helpers
shell-backend: ## Open shell in backend container
	docker-compose exec backend /bin/bash

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend /bin/sh

db-shell: ## Connect to ChromaDB (if running)
	@echo "$(BLUE)ChromaDB data location: ./backend/chroma_db$(RESET)"
	@echo "$(YELLOW)Use MCP tools in Claude Code to interact with ChromaDB$(RESET)"

# Claude Code Integration Management
claude-status: ## Check Claude Code slash command installation status
	@echo "$(BLUE)Checking Claude Code slash command status...$(RESET)"
	@if [ -f "$$HOME/.claude/commands/vault.md" ]; then \
		echo "$(GREEN)✅ Global vault command installed$(RESET)"; \
		echo "$(YELLOW)   Location: $$HOME/.claude/commands/vault.md$(RESET)"; \
		echo "$(YELLOW)   Size: $$(wc -l < "$$HOME/.claude/commands/vault.md") lines$(RESET)"; \
	else \
		echo "$(RED)❌ Global vault command not found$(RESET)"; \
	fi
	@if [ -f "claude-vault-command.md" ]; then \
		echo "$(GREEN)✅ Source vault command exists$(RESET)"; \
		echo "$(YELLOW)   Location: ./claude-vault-command.md$(RESET)"; \
		echo "$(YELLOW)   Size: $$(wc -l < "claude-vault-command.md") lines$(RESET)"; \
	else \
		echo "$(RED)❌ Source vault command not found$(RESET)"; \
	fi
	@echo "$(BLUE)💡 Usage: /vault collection_name your query here$(RESET)"

claude-update: ## Update Claude Code slash commands to latest version
	@echo "$(BLUE)Updating Claude Code slash commands...$(RESET)"
	@if [ -f "claude-vault-command.md" ]; then \
		echo "$(YELLOW)Backing up existing commands...$(RESET)"; \
		cp "$$HOME/.claude/commands/vault.md" "$$HOME/.claude/commands/vault.md.backup-$$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true; \
		echo "$(YELLOW)Installing updated vault command...$(RESET)"; \
		cp claude-vault-command.md "$$HOME/.claude/commands/vault.md"; \
		echo "$(GREEN)✅ Claude commands updated$(RESET)"; \
		echo "$(YELLOW)📝 Note: Restart Claude Code to load updated commands$(RESET)"; \
	else \
		echo "$(RED)❌ Source claude-vault-command.md not found in root directory$(RESET)"; \
		echo "$(YELLOW)💡 Run 'make install-claude-commands' first$(RESET)"; \
	fi

claude-uninstall: ## Remove Claude Code slash commands
	@echo "$(BLUE)Removing Claude Code slash commands...$(RESET)"
	@if [ -f "$$HOME/.claude/commands/vault.md" ]; then \
		echo "$(YELLOW)Creating backup before removal...$(RESET)"; \
		cp "$$HOME/.claude/commands/vault.md" "$$HOME/.claude/commands/vault.md.backup-$$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true; \
		rm "$$HOME/.claude/commands/vault.md"; \
		echo "$(GREEN)✅ Global vault command removed$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Global vault command not found$(RESET)"; \
	fi
	@echo "$(YELLOW)📝 Note: Restart Claude Code to unload commands$(RESET)"

claude-test: ## Test Claude Code slash command functionality
	@echo "$(BLUE)Testing Claude Code integration...$(RESET)"
	@if [ -f "$$HOME/.claude/commands/vault.md" ]; then \
		echo "$(GREEN)✅ Command file exists$(RESET)"; \
		echo "$(YELLOW)   Testing file structure...$(RESET)"; \
		if head -n 5 "$$HOME/.claude/commands/vault.md" | grep -q "name: vault"; then \
			echo "$(GREEN)✅ Command metadata valid$(RESET)"; \
		else \
			echo "$(RED)❌ Command metadata invalid$(RESET)"; \
		fi; \
		if grep -q "\$$ARGUMENTS" "$$HOME/.claude/commands/vault.md"; then \
			echo "$(GREEN)✅ Arguments handling implemented$(RESET)"; \
		else \
			echo "$(RED)❌ Arguments handling missing$(RESET)"; \
		fi; \
		if grep -q "chroma_list_collections" "$$HOME/.claude/commands/vault.md"; then \
			echo "$(GREEN)✅ ChromaDB MCP integration found$(RESET)"; \
		else \
			echo "$(RED)❌ ChromaDB MCP integration missing$(RESET)"; \
		fi; \
		echo "$(BLUE)💡 Manual test: Run '/vault test_collection hello' in Claude Code$(RESET)"; \
	else \
		echo "$(RED)❌ Command file not found$(RESET)"; \
		echo "$(YELLOW)💡 Run 'make install-claude-commands' first$(RESET)"; \
	fi