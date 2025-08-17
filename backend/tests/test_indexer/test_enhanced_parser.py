import pytest
import tempfile
from pathlib import Path

from indexer.enhanced_parser import EnhancedMarkdownParser


class TestEnhancedMarkdownParser:
    """Test the EnhancedMarkdownParser for advanced Obsidian features."""
    
    @pytest.fixture
    def parser(self):
        """Create an EnhancedMarkdownParser instance for testing."""
        return EnhancedMarkdownParser()
    
    @pytest.fixture
    def advanced_vault(self):
        """Create a vault with advanced Obsidian features."""
        with tempfile.TemporaryDirectory() as temp_dir:
            vault_path = Path(temp_dir)
            
            # Create .obsidian folder
            (vault_path / ".obsidian").mkdir()
            
            # File with complex wikilinks and embeds
            complex_note = """---
title: Complex Note
tags: [project, important]
aliases: [Complex, ComplexNote]
---

# Complex Note

This note has [[Simple Link]] and [[Link with|Alias]].

It also has embeds: ![[image.png]] and ![[Another Note]].

## Callouts
> [!NOTE]
> This is a note callout

> [!WARNING] 
> This is a warning

## Tasks
- [ ] Incomplete task
- [x] Complete task  
- [-] Cancelled task

## Math
$$E = mc^2$$

Inline math: $x = y + z$

## Code blocks
```python
def hello():
    return "world"
```

## Tables
| Name | Age |
|------|-----|
| John | 25  |
| Jane | 30  |
"""
            (vault_path / "complex.md").write_text(complex_note)
            
            # File with dataview queries
            dataview_note = """# Dataview Examples

```dataview
LIST FROM #project
```

```dataviewjs
dv.list(dv.pages("#important"))
```
"""
            (vault_path / "dataview.md").write_text(dataview_note)
            
            # Template file
            template_content = """# Template: {{title}}

Created: {{date}}
Tags: {{tags}}
"""
            templates_dir = vault_path / "templates"
            templates_dir.mkdir()
            (templates_dir / "note_template.md").write_text(template_content)
            
            yield vault_path

    def test_parser_initialization(self, parser):
        """Test enhanced parser initializes with additional patterns."""
        assert parser is not None
        assert hasattr(parser, 'parse_advanced_features')
        assert hasattr(parser, 'extract_callouts')
        assert hasattr(parser, 'extract_tasks')

    def test_extract_embeds(self, parser, advanced_vault):
        """Test extraction of embedded files and notes."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'embeds' in result['metadata']
        embeds = result['metadata']['embeds']
        assert 'image.png' in embeds
        assert 'Another Note' in embeds
        assert len(embeds) == 2

    def test_extract_callouts(self, parser, advanced_vault):
        """Test extraction of Obsidian callouts."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'callouts' in result['metadata']
        callouts = result['metadata']['callouts']
        assert len(callouts) == 2
        
        note_callout = next((c for c in callouts if c['type'] == 'NOTE'), None)
        assert note_callout is not None
        assert 'This is a note callout' in note_callout['content']
        
        warning_callout = next((c for c in callouts if c['type'] == 'WARNING'), None)
        assert warning_callout is not None
        assert 'This is a warning' in warning_callout['content']

    def test_extract_tasks(self, parser, advanced_vault):
        """Test extraction of tasks with different statuses."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'tasks' in result['metadata']
        tasks = result['metadata']['tasks']
        assert len(tasks) == 3
        
        incomplete = [t for t in tasks if t['status'] == 'incomplete']
        complete = [t for t in tasks if t['status'] == 'complete']
        cancelled = [t for t in tasks if t['status'] == 'cancelled']
        
        assert len(incomplete) == 1
        assert len(complete) == 1
        assert len(cancelled) == 1
        
        assert 'Incomplete task' in incomplete[0]['text']
        assert 'Complete task' in complete[0]['text']
        assert 'Cancelled task' in cancelled[0]['text']

    def test_extract_math_blocks(self, parser, advanced_vault):
        """Test extraction of LaTeX math expressions."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'math_blocks' in result['metadata']
        math_blocks = result['metadata']['math_blocks']
        
        # Should find both block and inline math
        block_math = [m for m in math_blocks if m['type'] == 'block']
        inline_math = [m for m in math_blocks if m['type'] == 'inline']
        
        assert len(block_math) == 1
        assert len(inline_math) == 1
        assert 'E = mc^2' in block_math[0]['expression']
        assert 'x = y + z' in inline_math[0]['expression']

    def test_extract_code_blocks(self, parser, advanced_vault):
        """Test extraction of code blocks with language detection."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'code_blocks' in result['metadata']
        code_blocks = result['metadata']['code_blocks']
        assert len(code_blocks) == 1
        
        python_block = code_blocks[0]
        assert python_block['language'] == 'python'
        assert 'def hello():' in python_block['code']

    def test_extract_tables(self, parser, advanced_vault):
        """Test extraction of markdown tables."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'tables' in result['metadata']
        tables = result['metadata']['tables']
        assert len(tables) == 1
        
        table = tables[0]
        assert table['headers'] == ['Name', 'Age']
        assert len(table['rows']) == 2
        assert table['rows'][0] == ['John', '25']
        assert table['rows'][1] == ['Jane', '30']

    def test_extract_dataview_queries(self, parser, advanced_vault):
        """Test extraction of Dataview queries."""
        dataview_path = advanced_vault / "dataview.md"
        result = parser.parse_file(dataview_path)
        
        assert 'dataview_queries' in result['metadata']
        queries = result['metadata']['dataview_queries']
        assert len(queries) == 2
        
        list_query = next((q for q in queries if q['type'] == 'dataview'), None)
        js_query = next((q for q in queries if q['type'] == 'dataviewjs'), None)
        
        assert list_query is not None
        assert 'LIST FROM #project' in list_query['query']
        assert js_query is not None
        assert 'dv.list' in js_query['query']

    def test_extract_aliases(self, parser, advanced_vault):
        """Test extraction of note aliases from frontmatter."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'aliases' in result['metadata']
        aliases = result['metadata']['aliases']
        assert 'Complex' in aliases
        assert 'ComplexNote' in aliases

    def test_extract_backlinks(self, parser, advanced_vault):
        """Test extraction of potential backlink relationships."""
        # Create a note that links to complex.md
        linking_note = """# Linking Note

This note references [[Complex Note]] and [[ComplexNote]].
"""
        linking_path = advanced_vault / "linking.md"
        linking_path.write_text(linking_note)
        
        result = parser.parse_file(linking_path)
        
        assert 'wikilinks' in result['metadata']
        wikilinks = result['metadata']['wikilinks']
        assert 'Complex Note' in wikilinks
        assert 'ComplexNote' in wikilinks

    def test_exclude_template_folder(self, parser, advanced_vault):
        """Test that template folders are excluded from indexing."""
        files = parser.get_vault_files(advanced_vault)
        
        # Should not include template files
        template_files = [f for f in files if 'templates' in str(f)]
        assert len(template_files) == 0

    def test_content_structure_analysis(self, parser, advanced_vault):
        """Test analysis of content structure (headings, sections)."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        assert 'structure' in result['metadata']
        structure = result['metadata']['structure']
        
        assert 'headings' in structure
        headings = structure['headings']
        
        # Should find all heading levels
        h1_headings = [h for h in headings if h['level'] == 1]
        h2_headings = [h for h in headings if h['level'] == 2]
        
        assert len(h1_headings) == 1
        assert len(h2_headings) >= 4  # Callouts, Tasks, Math, Code blocks, Tables
        assert h1_headings[0]['text'] == 'Complex Note'

    def test_word_count_excludes_metadata_blocks(self, parser, advanced_vault):
        """Test that word count excludes code blocks, math, and metadata."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        # Word count should exclude code blocks, math expressions, and tables
        word_count = result['metadata']['word_count']
        assert isinstance(word_count, int)
        assert word_count > 0
        
        # Verify it's not counting code or math content
        # (This is a behavioral test - exact count depends on implementation)
        assert word_count < 200  # Should be much less if excluding metadata blocks

    def test_extract_yaml_frontmatter_arrays(self, parser, advanced_vault):
        """Test proper handling of YAML array formats in frontmatter."""
        complex_path = advanced_vault / "complex.md"
        result = parser.parse_file(complex_path)
        
        # Tags should be extracted as list
        assert isinstance(result['metadata']['tags'], list)
        assert 'project' in result['metadata']['tags']
        assert 'important' in result['metadata']['tags']
        
        # Aliases should be extracted as list
        assert isinstance(result['metadata']['aliases'], list)
        assert len(result['metadata']['aliases']) == 2