<div align="center">

<img src="frontend/public/logo.svg" alt="VaultMind" width="300">

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

### 🚀 Enhanced Vault Management
- **📋 Multi-vault Dashboard**: Manage multiple Obsidian vaults simultaneously
- **📊 Real-time Progress**: WebSocket-based indexing with live updates
- **⚡ One-click Re-indexing**: Easy vault refresh with confirmation dialogs
- **💾 Smart Size Calculation**: Accurate vault size tracking and display
- **🔍 Vault Status Monitoring**: Health indicators, document counts, indexing status

### 🎯 Advanced Search & Discovery
- **🔍 Semantic Search**: Find notes by meaning, not just keywords
- **🔧 Search Filters**: Filter by file type, date range, folders, and tags
- **📚 Search History**: Automatic search history with export capabilities
- **💡 Smart Suggestions**: Intelligent query suggestions and auto-complete
- **📄 Pagination**: Efficient result pagination for large datasets
- **📤 Result Actions**: Copy, export, and share search results

### ⚙️ Configuration & Management
- **🎛️ Visual Settings Panel**: GUI-based configuration management
- **🔧 Advanced Settings**: Chunk size, embedding models, performance tuning
- **⏰ Schedule Configuration**: Visual schedule builder for automatic re-indexing
- **📁 Path Picker**: Directory browser for vault path selection
- **👁️ Config Preview**: Real-time preview of configuration changes

### 🎨 Modern User Experience
- **🌓 Dark/Light Theme**: Automatic theme detection and manual toggle
- **📱 Responsive Design**: Mobile-friendly responsive layouts
- **⚡ Loading States**: Sophisticated loading spinners and skeleton screens
- **🛡️ Error Boundaries**: Graceful error handling with user-friendly messages
- **🔗 Connection Status**: Real-time WebSocket connection monitoring

### 🤖 Claude Code Integration
- **💬 Direct Access**: Query your notes directly in Claude Code
- **🗂️ Collection Management**: Access indexed vaults via ChromaDB MCP
- **⚡ Instant Results**: Sub-second semantic search responses

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React 19 SPA      │    │   FastAPI + WS      │    │   ChromaDB          │
│   TypeScript        │◄───┤   Python 3.12       │◄───┤   Vector Storage    │
│   Zustand + TanStack│    │   Async/Await       │    │   Local Embeddings  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                           │
    ┌────▼────┐                 ┌────▼────┐                 ┌────▼────┐
    │ Modern  │                 │ Enhanced│                 │ Sentence│
    │ Hooks & │                 │ Parser &│                 │ Transformers
    │ Context │                 │ Chunker │                 │ + OpenAI│
    └─────────┘                 └─────────┘                 └─────────┘
         │                           │                           │
    WebSocket +                 REST API +               Semantic Search +
    Real-time UI               File Processing           Vector Similarity
```

### Integration Points

- **Claude Code MCP**: Direct ChromaDB access via `/vault` commands
- **Docker Development**: Complete containerized development environment  
- **Real-time Updates**: WebSocket connection for live indexing progress
- **Multi-Vault Support**: Concurrent management of multiple knowledge bases

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

### Current Tech Stack

#### Backend (Python 3.12+)
- **FastAPI 0.116.1**: Async web framework with auto-documentation
- **ChromaDB 1.0.17**: Vector database for semantic search
- **Sentence Transformers 5.1.0**: Local embedding generation
- **Pydantic 2.11.7**: Modern data validation and serialization
- **pytest 8.4.1**: Testing framework with 58% coverage
- **WebSocket Support**: Real-time progress updates and live communication

#### Frontend (Node 22 LTS)
- **React 19.1.1**: Latest React with modern concurrent features
- **TypeScript 5.8.3**: Strict type checking and modern JS features
- **Vite 7.1.2**: Fast build tool with optimized development server
- **TailwindCSS 3.4.17**: Utility-first styling with dark mode support
- **Zustand 5.0.7**: Lightweight state management
- **TanStack Query 5.85.3**: Server state management and caching
- **Real-time WebSocket**: Live indexing progress and status updates

#### Infrastructure & DevOps
- **Docker 27.0+**: Development environment containerization
- **Make**: 40+ development commands for complete workflow automation
- **Vitest 3.2.4**: Fast unit testing (current 8% coverage, improving)
- **ESLint + Prettier**: Code quality and formatting
- **GitHub Integration**: Ready for CI/CD pipeline setup

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
├── frontend/                    # React 19 TypeScript SPA
│   ├── src/components/         # Feature-organized React components
│   ├── src/hooks/              # Custom React hooks library
│   ├── src/stores/             # Zustand state management
│   ├── src/services/           # API client and utilities
│   └── package.json           # Frontend dependencies (Node 22)
├── backend/                    # FastAPI Python 3.12 service
│   ├── api/routes/            # REST API endpoints
│   ├── database/              # ChromaDB integration layer
│   ├── indexer/               # Markdown parsing & text chunking
│   ├── services/              # Business logic layer
│   ├── app.py                # FastAPI application entry point
│   └── requirements.txt       # Python dependencies
├── docs/                      # Comprehensive documentation
│   ├── BROWNFIELD_ARCHITECTURE.md # Current system architecture
│   └── SYSTEM.md              # Technical system reference
├── docker-compose.yml         # Development environment setup
├── Makefile                   # 40+ development commands
├── CHANGELOG.md              # Version history and roadmap
└── README.md                 # You are here
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