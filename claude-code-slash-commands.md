# 🧠 Vault Mind - Claude Code Slash Command

**Single intelligent command for seamless interaction with your indexed Obsidian vault**

Transform your Vault Mind indexed knowledge base into an AI-powered assistant with one simple slash command that handles everything: MCP connection verification, collection access, and intelligent query processing.

## 🚀 Quick Start

### Installation

1. **Copy the command file** to your Claude Code commands directory:
   ```bash
   mkdir -p .claude/commands
   cp vault-mind.md .claude/commands/
   ```

2. **Restart Claude Code** to load the new command

3. **Start using immediately**:
   ```bash
   /vault-mind my_collection "search for productivity tips"
   ```

## 📋 The `/vault-mind` Command

**Single command for all vault interactions**

```bash
/vault-mind <collection_name> <query>
```

### Arguments

- **`collection_name`**: Your ChromaDB collection name (e.g., `vault_mind`, `my_notes`)
- **`query`**: Natural language query - search terms, requests for quiz/summary/analysis, or any question

### What It Does Automatically

1. **🔌 MCP Connection Check**: Verifies ChromaDB MCP is connected
2. **📂 Collection Access**: Confirms your collection exists and is accessible  
3. **🧠 Intelligent Processing**: Interprets your query and chooses optimal approach
4. **🛠️ Error Guidance**: Provides step-by-step help for any issues

## 🎯 Usage Examples

### Simple Search
```bash
/vault-mind my_notes "machine learning algorithms"
/vault-mind research_vault "find notes about project management"
```

### Generate Quiz
```bash
/vault-mind study_collection "create a quiz on quantum physics with 8 questions"
/vault-mind work_notes "make me a test about leadership styles"
```

### Request Summary
```bash
/vault-mind personal_vault "summarize everything about productivity methods"
/vault-mind research_notes "give me an overview of sustainable technology"
```

### Deep Analysis
```bash
/vault-mind my_collection "analyze the connections between AI and ethics"
/vault-mind study_vault "compare different learning theories in my notes"
```

### Content Creation
```bash
/vault-mind writing_notes "create an outline for a blog post about remote work"
/vault-mind research_vault "help me plan a presentation on climate change"
```

### Direct Questions
```bash
/vault-mind my_knowledge "what are the key principles of effective communication?"
/vault-mind study_notes "how do neural networks work according to my notes?"
```

## 🔧 Smart Features

### Automatic Query Type Detection

The command intelligently recognizes what you want based on your query language:

| Query Pattern | Detection | Action |
|---------------|-----------|---------|
| Keywords, topics | **Search** | Semantic search with relevant results |
| "quiz", "test", "questions" | **Quiz Generation** | Creates questions with answers and references |
| "summarize", "overview" | **Summary** | Structured summary with key insights |
| "analyze", "compare", "connections" | **Analysis** | Deep analytical insights and patterns |
| "outline", "create", "plan" | **Content Creation** | Structured outlines and frameworks |
| Questions ("what", "how", "why") | **Q&A** | Direct answers from your vault content |

### Error Handling & Guidance

**MCP Issues**:
- Automatic detection of missing ChromaDB MCP
- Step-by-step installation instructions
- Configuration troubleshooting

**Collection Issues**:
- Lists available collections if name not found
- Guides to Vault Mind indexing process
- Explains naming conventions

**Query Issues**:
- Suggests better search terms for poor results
- Provides query optimization tips
- Handles edge cases gracefully

## 🛠️ Troubleshooting

### Common Issues

#### "chroma_list_collections not found"
**Solution**: ChromaDB MCP is not installed or connected
1. Install ChromaDB MCP in Claude Code
2. Restart Claude Code
3. Verify MCP connection in settings

#### "Collection 'vault_name' not found"
**Solutions**:
1. Check available collections: `/vault-mind "" "list my collections"`
2. Verify vault is indexed in Vault Mind UI: http://localhost:5173
3. Use correct collection name format: `vault_[name]`

#### "No results found"
**Solutions**:
1. Try broader search terms
2. Check collection has content
3. Use different query approaches
4. Verify indexing completed successfully

### Performance Tips

1. **Use specific terms**: "machine learning algorithms" vs "AI stuff"
2. **Include context**: "project management agile methodology" vs "management"
3. **Try variations**: If no results, rephrase your query
4. **Start broad**: Then narrow down with follow-up queries

## 📚 Advanced Usage

### Collection Path Formats

```bash
# Standard collection name
/vault-mind my_vault "query here"

# Full path (if needed)
/vault-mind /path/to/chroma_db/collection_name "query here"

# Default Vault Mind naming
/vault-mind vault_mind "query here"
```

### Multi-step Workflows

1. **Explore a topic**:
   ```bash
   /vault-mind my_notes "find everything about leadership"
   ```

2. **Deep dive**:
   ```bash
   /vault-mind my_notes "analyze different leadership styles and their effectiveness"
   ```

3. **Create content**:
   ```bash
   /vault-mind my_notes "create a presentation outline on transformational leadership"
   ```

4. **Test knowledge**:
   ```bash
   /vault-mind my_notes "generate a quiz on leadership theories with explanations"
   ```

### Query Optimization

**Good Examples**:
```bash
# Specific and contextual
/vault-mind research "machine learning applications in healthcare"

# Clear intent
/vault-mind study_notes "create a summary of cognitive psychology theories"

# Natural questions
/vault-mind work_vault "what are the best practices for remote team management?"
```

**Less Effective**:
```bash
# Too vague
/vault-mind notes "stuff about AI"

# Unclear intent  
/vault-mind collection "leadership"
```

## 🎯 Best Practices

### Query Formulation
1. **Be specific**: Use detailed terms that match your note content
2. **Include context**: Add relevant context to improve results
3. **State your intent**: Clearly indicate if you want search, quiz, summary, etc.
4. **Use natural language**: Write queries as you would ask a human expert

### Collection Management
1. **Consistent naming**: Use clear, consistent collection names
2. **Regular updates**: Keep your indexed content current
3. **Logical organization**: Organize collections by topic or purpose
4. **Size optimization**: Monitor collection size for performance

### Workflow Integration
1. **Start simple**: Begin with basic searches, then move to complex analysis
2. **Iterate**: Use results to refine follow-up queries
3. **Document patterns**: Note successful query patterns for reuse
4. **Combine approaches**: Mix different query types for comprehensive insights

## 🚀 Getting Started Checklist

- [ ] Vault Mind is running (`make dev`)
- [ ] Vault is indexed via http://localhost:5173  
- [ ] ChromaDB MCP is installed and connected in Claude Code
- [ ] Command file is in `.claude/commands/vault-mind.md`
- [ ] Claude Code has been restarted
- [ ] Test basic query: `/vault-mind your_collection "test search"`
- [ ] Experiment with different query types
- [ ] Bookmark successful query patterns

---

## 💡 Pro Tips

### Power User Workflows

**Research Session**:
```bash
# 1. Explore the landscape
/vault-mind research "find all content about sustainable energy"

# 2. Analyze patterns  
/vault-mind research "analyze trends in renewable energy adoption"

# 3. Create deliverable
/vault-mind research "create executive summary of clean energy opportunities"
```

**Study Session**:
```bash
# 1. Review content
/vault-mind study_notes "summarize machine learning fundamentals"

# 2. Test understanding
/vault-mind study_notes "quiz me on neural network concepts with 10 questions"

# 3. Find gaps
/vault-mind study_notes "what advanced topics should I study next in ML?"
```

**Content Creation**:
```bash
# 1. Research foundation
/vault-mind writing_vault "gather all content about productivity frameworks"

# 2. Structure content
/vault-mind writing_vault "create blog post outline: productivity for remote workers"

# 3. Support with evidence
/vault-mind writing_vault "find case studies and examples for productivity article"
```

---

*One command. Infinite possibilities. Transform your personal knowledge into an intelligent AI assistant.* 

**Your vault awaits! 🧠✨**

---

## 🔄 Command Evolution

This single `/vault-mind` command replaces the need for multiple specialized commands by using Claude's natural language understanding to interpret your intent and choose the optimal approach. It's designed to grow with your needs and handle increasingly sophisticated queries as you become more familiar with the system.

**Simple to start. Powerful to master.** 🚀