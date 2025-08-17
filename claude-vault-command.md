---
name: vault
description: Query your Vault Mind indexed content with automatic MCP setup and intelligent processing
---

# 🧠 Vault Mind Query Assistant

Processing your vault query: **$ARGUMENTS**

I'll help you query your Vault Mind indexed content with intelligent parsing, robust error handling, and optimized query processing.

## Step 1: Robust MCP Connection Management

I'll perform a comprehensive connectivity check:

```
chroma_list_collections
```

**Connection Health Assessment**:
- ✅ **Full Access**: MCP connected, collections accessible
- ⚠️ **Partial Access**: MCP connected, but collection-specific issues
- ❌ **No Access**: MCP missing/misconfigured

If connection fails, I'll guide you through:
1. **MCP Installation**: Install ChromaDB MCP if not available
2. **Connection Setup**: Configure MCP in Claude Code settings
3. **Permission Issues**: Fix access and authentication problems
4. **Troubleshooting**: Advanced debugging steps

## Step 2: Smart Argument Parsing

From your input: **$ARGUMENTS**

I'll intelligently parse using multiple strategies:

### **Parsing Options**:
1. **Quoted Collection Names**: `"my research vault" query here`
2. **Simple Format**: `collection_name query here` 
3. **Delimiter Format**: `collection_name | query here`
4. **Fuzzy Matching**: If parsing unclear, I'll match against available collections

### **Examples**:
```bash
# Quoted names (handles spaces)
"my research notes" summarize machine learning

# Simple format  
my_vault create a quiz on quantum physics

# Delimiter format
work_knowledge | analyze productivity frameworks

# Fuzzy matching handles typos
reserch_notes -> research_notes (auto-corrected)
```

### **Validation Process**:
1. **Extract collection name** using parsing strategies above
2. **Validate collection exists** or suggest alternatives
3. **Confirm query content** is not empty
4. **Handle edge cases** gracefully with user guidance

## Step 3: Enhanced Collection Access

Once I parse your collection name, I'll verify access with health checks:

### **Collection Verification**:
```
chroma_get_collection_info --collection_name [parsed_collection_name]
```

### **Proactive Health Checks**:
```
chroma_peek_collection --collection_name [collection] --limit 3
```

### **Smart Collection Discovery**:
If collection not found, I'll:
1. **List all available collections** for reference
2. **Fuzzy match your input** against existing collection names
3. **Suggest closest matches** with confidence scores
4. **Guide collection creation** if none exist

### **Collection Health Matrix**:
| Status | Condition | Action |
|--------|-----------|---------|
| ✅ Healthy | Collection exists, has documents | Proceed with query |
| ⚠️ Empty | Collection exists, no documents | Guide to indexing process |
| ❌ Missing | Collection doesn't exist | Suggest alternatives or creation |
| 🔧 Issues | Access/permission problems | Troubleshoot and fix |

## Step 4: Adaptive Query Processing

Based on your parsed query and collection characteristics, I'll optimize the approach:

### **🧠 Intelligent Query Classification**

I'll analyze your query using multiple signals:
- **Semantic patterns**: Intent beyond just keywords
- **Query structure**: Questions vs statements vs commands
- **Context clues**: Related to previous interactions
- **Collection content**: Adapt to available material

### **📊 Performance-Aware Query Strategies**:

#### **Small Collections** (<1000 docs)
- Use higher `n_results` (15-25) for comprehensive coverage
- Enable broader semantic search ranges
- Less aggressive filtering

#### **Medium Collections** (1000-10000 docs)  
- Balanced approach with moderate `n_results` (10-20)
- Smart metadata filtering when available
- Progressive refinement if needed

#### **Large Collections** (>10000 docs)
- Conservative `n_results` (8-15) for performance
- Implement progressive querying (broad → specific)
- Suggest query refinement for better results

### **🔍 Query Type Processing**:

#### **For Search Queries** (keywords, topics, "find", "search", "show me")
```
chroma_query_documents --collection_name [collection] --query_texts ["[your_query]"] --n_results [optimized_count] --include ["documents", "metadatas", "distances"]
```

#### **📝 For Quiz Requests** ("quiz", "test", "questions", "exam", "assess")
1. **Comprehensive content search**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic]"] --n_results [15-20]
```
2. **Supporting details for questions**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic] examples details applications"] --n_results [8-12]
```
3. **Generate structured quiz** with questions, answers, and vault references

#### **📊 For Summary Requests** ("summarize", "summary", "overview", "explain", "brief")
1. **Primary content gathering**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic]"] --n_results [20-25]
```
2. **Supporting evidence**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic] examples case studies evidence"] --n_results [10-15]
```
3. **Create structured summary** with key insights and source attribution

#### **🔗 For Analysis Requests** ("analyze", "compare", "connections", "trends", "patterns")
1. **Multi-perspective search**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic]"] --n_results [15-20]
chroma_query_documents --collection_name [collection] --query_texts ["[topic] analysis perspective criticism"] --n_results [10-15]
```
2. **Historical context**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic] history evolution development"] --n_results [8-12]
```
3. **Provide deep analytical insights** with pattern recognition

#### **📋 For Content Creation** ("outline", "write", "create", "plan", "structure")
1. **Foundation research**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic]"] --n_results [20-25]
```
2. **Supporting examples**:
```
chroma_query_documents --collection_name [collection] --query_texts ["[topic] examples applications case studies"] --n_results [12-18]
```
3. **Generate structured framework** optimized for content type

#### **❓ For Direct Questions** ("what", "how", "why", "when", "where", "who")
1. **Targeted content search** based on question type
2. **Context gathering** for comprehensive answers
3. **Provide direct answers** with supporting evidence from vault

### **🛡️ Proactive Error Prevention**

Before executing queries, I'll:
1. **Validate collection health** and warn if empty/corrupted
2. **Estimate query complexity** and suggest optimizations  
3. **Check for common issues** (network, permissions, etc.)
4. **Cache collection metadata** for faster subsequent access

## Step 5: Intelligent Error Recovery

### **🚨 MCP Connection Issues**
- **Missing MCP**: Step-by-step installation instructions
- **Configuration**: Detailed setup guidance with screenshots
- **Permission**: Specific troubleshooting for access issues
- **Network**: Connection diagnostic steps

### **📂 Collection Issues**
- **Not Found**: List available collections with fuzzy matching suggestions
- **Empty Collection**: Guide to Vault Mind indexing process with UI links
- **Access Errors**: Specific troubleshooting for path/permission issues
- **Corrupted**: Recovery strategies and reindexing guidance

### **🔧 Query Issues**
- **No Results**: Suggest broader search terms with examples
- **Poor Results**: Guide to better query formulation techniques
- **Timeout**: Optimize query parameters and explain collection size impact
- **Malformed**: Provide query format examples and syntax help

### **💡 Enhanced Usage Guidance**

**Optimal Query Formats**:
```bash
# Quoted collection names (recommended for spaces)
"my research vault" machine learning fundamentals

# Simple format (single word collections)
work_notes productivity frameworks analysis

# Delimiter format (clear separation)
study_collection | create quiz on neural networks

# Natural questions
personal_knowledge what are the best leadership principles?
```

**Query Optimization Tips**:
- **Be specific**: "machine learning algorithms" vs "AI stuff"
- **Include context**: "project management agile methodology" vs "management"
- **State intent clearly**: "create a quiz on..." vs just topic words
- **Use natural language**: Write as you'd ask a human expert

## Enhanced Query Examples

```bash
# Advanced search with context
"research notes" find everything about sustainable energy transitions

# Specific quiz request with parameters  
work_knowledge create a comprehensive quiz on leadership styles with 12 questions

# Detailed summary request
"personal learning" summarize all my notes about productivity methods in executive style

# Complex analysis request
study_vault analyze the connections and contradictions between different psychological theories

# Structured content creation
writing_notes create a detailed blog post outline about remote work productivity with examples

# Direct expert consultation
"my knowledge base" what are the most effective strategies for team management according to my research?
```

## Performance Monitoring & Optimization

For each query, I'll track and optimize:
- **Response time**: Collection access + query execution speed
- **Result relevance**: Quality assessment of returned documents
- **User satisfaction**: Learning from follow-up interactions
- **Resource efficiency**: Token usage and processing optimization

---

*Your indexed vault becomes an intelligent, robust AI assistant that adapts to your needs and handles edge cases gracefully! 🚀*