<div align="center">

```
██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗    ███╗   ███╗██╗███╗   ██╗██████╗ 
██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝    ████╗ ████║██║████╗  ██║██╔══██╗
██║   ██║███████║██║   ██║██║     ██║       ██╔████╔██║██║██╔██╗ ██║██║  ██║
╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║       ██║╚██╔╝██║██║██║╚██╗██║██║  ██║
 ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║       ██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝       ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ 
```

# 🧠 Vault Mind

**Transform your Obsidian vault into an AI-powered knowledge assistant**

[![GitHub](https://img.shields.io/badge/GitHub-reza899%2Fvault--mind-blue?style=for-the-badge&logo=github)](https://github.com/reza899/vault-mind)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)](https://docs.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Database-orange?style=for-the-badge)](https://www.trychroma.com/)

</div>

Vault Mind indexes your Obsidian notes into ChromaDB, enabling semantic search and AI interactions through Claude Code. Perfect for researchers, students, and knowledge workers who want to unlock the full potential of their note collections.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for development)
- Python 3.12+ (for development)

### Run with Docker (Recommended)
```bash
git clone https://github.com/reza899/vault-mind.git
cd vault-mind
make quick-start  # Installs deps and starts development environment
```

Visit http://localhost:5173 to configure your first vault.

### Available Commands
```bash
make help           # Show all available commands
make dev            # Start development environment
make test           # Run all tests  
make lint           # Check code quality
make claude-status  # Check Claude Code integration status
make clean          # Clean up containers and data
```

### Claude Code Integration
The development environment automatically installs a powerful `/vault` slash command for Claude Code:

```bash
# Automatically installed with make install or make quick-start
/vault collection_name your query here

# Examples:
/vault my_notes "create a quiz on machine learning" 
/vault research_vault "summarize productivity frameworks"
/vault study_collection "analyze connections between AI and ethics"
```

**Management Commands:**
```bash
make claude-status     # Check installation status
make claude-update     # Update to latest command version  
make claude-test       # Test command functionality
make claude-uninstall  # Remove commands (with backup)
```

### Local Development
```bash
# Install dependencies and start development servers
make install
make dev

# Or start locally without Docker
make dev-local
```

## ✨ Features

- **🔍 Semantic Search**: Find notes by meaning, not just keywords
- **⚡ Real-time Indexing**: Automatic updates when files change
- **🔗 Link Analysis**: Understands Obsidian's wikilinks and backlinks
- **📋 Multi-vault Support**: Index multiple knowledge bases
- **🤖 Claude Code Integration**: Query your notes directly in Claude
- **📊 Progress Tracking**: Live indexing status and statistics
- **⚙️ Flexible Scheduling**: Configure indexing frequency

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │◄───┤   FastAPI       │◄───┤   ChromaDB      │
│   (Frontend)    │    │   (Backend)     │    │   (Vector DB)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    WebSocket for            REST API &               Embeddings &
    real-time updates        file processing          vector search
```

## 🔧 Configuration

### Environment Variables
```bash
# Backend
CHROMA_PERSIST_DIR=./chroma_db
EMBEDDING_MODEL=all-MiniLM-L6-v2
OPENAI_API_KEY=sk-...  # Optional for OpenAI embeddings

# Frontend  
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Default Settings
- **Chunk Size**: 1000 tokens with 200 token overlap
- **Supported Files**: `.md`, `.txt`
- **Ignored Folders**: `.obsidian`, `.trash`, `templates`
- **Embedding Model**: Local Sentence Transformers (no API required)

## 💡 Use Cases

### With Claude Code MCP Integration
Access your indexed vault through ChromaDB MCP tools:
```bash
# List your indexed collections
chroma_list_collections

# Query your vault semantically
chroma_query_documents --collection_name vault_your_name --query_texts ["explain quantum computing"]

# Get specific documents
chroma_get_documents --collection_name vault_your_name --limit 10
```

### Via Web Interface
- Configure vault paths and indexing schedules
- Monitor indexing progress in real-time
- Search through your knowledge base semantically
- View collection statistics and metadata

## 🛠️ Development

### Tech Stack
- **Backend**: FastAPI, ChromaDB, Sentence Transformers
- **Frontend**: React 19, TypeScript, Tailwind CSS, Zustand
- **Testing**: pytest (backend), Vitest (frontend)
- **DevOps**: Docker, GitHub Actions

### Commands
```bash
# Development
make dev           # Start development environment
make dev-local     # Start without Docker
make install       # Install all dependencies

# Testing & Quality
make test          # Run all tests with coverage
make test-watch    # Run tests in watch mode
make lint          # Check code quality
make format        # Auto-format code
make ci            # Run CI checks locally

# Production & Deployment
make build         # Build Docker images
make prod          # Start production environment
make clean         # Clean up containers and volumes

# Utilities
make logs          # View service logs
make health        # Check service health
make help          # Show all available commands
```

## 📁 Project Structure
```
vault-mind/
├── frontend/              # React TypeScript UI
├── backend/              # FastAPI Python service  
├── docs/                 # Architecture & planning docs
├── claude-vault-command.md # Claude Code slash command
├── docker-compose.yml    # Development environment
├── Makefile             # Development commands
└── README.md            # You are here
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`make test`)
5. Check code quality (`make lint`)
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📜 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md) for creating an amazing note-taking tool
- [ChromaDB](https://github.com/chroma-core/chroma) for the vector database
- [Claude Code](https://claude.ai/code) for AI-powered development tools

---

**Ready to unlock your knowledge?** [Get started in 5 minutes](#-quick-start) or [join our community](https://github.com/reza899/vault-mind/discussions) 🚀