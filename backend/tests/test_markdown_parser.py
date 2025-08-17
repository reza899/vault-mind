import pytest
import tempfile
from pathlib import Path

from indexer.markdown_parser import MarkdownParser


class TestMarkdownParser:
    """Test the MarkdownParser class for processing Obsidian vault files."""
    
    @pytest.fixture
    def parser(self):
        """Create a MarkdownParser instance for testing."""
        return MarkdownParser()
    
    @pytest.fixture
    def sample_vault(self):
        """Create a temporary vault with sample markdown files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            vault_path = Path(temp_dir)
            
            # Create .obsidian folder to simulate valid vault
            (vault_path / ".obsidian").mkdir()
            
            # Sample markdown file with frontmatter
            note1_content = """---
title: Test Note 1
tags: [test, sample]
created: 2024-01-01
---

# Test Note 1

This is a sample note with **bold text** and *italic text*.

## Section 1

Some content here with [[linked note]] reference.

- List item 1
- List item 2

```python
def hello():
    return "Hello World"
```
"""
            (vault_path / "note1.md").write_text(note1_content)
            
            # Simple markdown file without frontmatter
            note2_content = """# Simple Note

This is a simple note without frontmatter.

Contains a [[wikilink]] and normal text.
"""
            (vault_path / "note2.md").write_text(note2_content)
            
            # File in subfolder
            subfolder = vault_path / "subfolder"
            subfolder.mkdir()
            note3_content = """# Subfolder Note

This note is in a subfolder.
"""
            (subfolder / "note3.md").write_text(note3_content)
            
            # Non-markdown file (should be ignored)
            (vault_path / "image.png").write_text("fake image")
            
            yield vault_path

    def test_parser_initialization(self, parser):
        """Test that parser initializes correctly."""
        assert parser is not None
        assert hasattr(parser, 'parse_file')
        assert hasattr(parser, 'get_vault_files')

    def test_get_vault_files_finds_markdown_files(self, parser, sample_vault):
        """Test that get_vault_files finds all markdown files in vault."""
        files = parser.get_vault_files(sample_vault)
        
        # Should find 3 markdown files
        assert len(files) == 3
        
        # Check that all files are .md files
        for file_path in files:
            assert file_path.suffix == '.md'
        
        # Check specific files are found
        file_names = [f.name for f in files]
        assert 'note1.md' in file_names
        assert 'note2.md' in file_names
        assert 'note3.md' in file_names

    def test_get_vault_files_excludes_obsidian_folder(self, parser, sample_vault):
        """Test that .obsidian folder is excluded from file list."""
        # Create a markdown file in .obsidian folder
        obsidian_file = sample_vault / ".obsidian" / "config.md"
        obsidian_file.write_text("# Config file")
        
        files = parser.get_vault_files(sample_vault)
        
        # Should not include files from .obsidian folder
        obsidian_files = [f for f in files if '.obsidian' in str(f)]
        assert len(obsidian_files) == 0

    def test_get_vault_files_excludes_trash_folder(self, parser, sample_vault):
        """Test that .trash folder is excluded from file list."""
        # Create .trash folder with file
        trash_folder = sample_vault / ".trash"
        trash_folder.mkdir()
        trash_file = trash_folder / "deleted.md"
        trash_file.write_text("# Deleted file")
        
        files = parser.get_vault_files(sample_vault)
        
        # Should not include files from .trash folder
        trash_files = [f for f in files if '.trash' in str(f)]
        assert len(trash_files) == 0

    def test_parse_file_with_frontmatter(self, parser, sample_vault):
        """Test parsing a markdown file with YAML frontmatter."""
        note1_path = sample_vault / "note1.md"
        result = parser.parse_file(note1_path)
        
        assert result is not None
        assert 'content' in result
        assert 'metadata' in result
        assert 'file_path' in result
        
        # Check metadata extraction
        assert result['metadata']['title'] == 'Test Note 1'
        assert 'test' in result['metadata']['tags']
        assert 'sample' in result['metadata']['tags']
        # frontmatter parses dates as datetime.date objects
        import datetime
        assert result['metadata']['created'] == datetime.date(2024, 1, 1)
        
        # Check content (should not include frontmatter)
        assert result['content'].startswith('# Test Note 1')
        assert '---' not in result['content']  # Frontmatter removed
        
        # Check wikilinks are preserved
        assert '[[linked note]]' in result['content']

    def test_parse_file_without_frontmatter(self, parser, sample_vault):
        """Test parsing a markdown file without frontmatter."""
        note2_path = sample_vault / "note2.md"
        result = parser.parse_file(note2_path)
        
        assert result is not None
        assert 'content' in result
        assert 'metadata' in result
        
        # Should have empty or minimal metadata
        assert isinstance(result['metadata'], dict)
        
        # Content should be the full file
        assert result['content'].startswith('# Simple Note')
        assert '[[wikilink]]' in result['content']

    def test_parse_file_preserves_markdown_formatting(self, parser, sample_vault):
        """Test that markdown formatting is preserved during parsing."""
        note1_path = sample_vault / "note1.md"
        result = parser.parse_file(note1_path)
        
        content = result['content']
        
        # Check various markdown elements are preserved
        assert '**bold text**' in content
        assert '*italic text*' in content
        assert '## Section 1' in content
        assert '- List item 1' in content
        assert '```python' in content

    def test_parse_nonexistent_file_raises_error(self, parser):
        """Test that parsing a non-existent file raises appropriate error."""
        nonexistent_path = Path("/nonexistent/file.md")
        
        with pytest.raises(FileNotFoundError):
            parser.parse_file(nonexistent_path)

    def test_get_vault_files_invalid_vault_raises_error(self, parser):
        """Test that invalid vault path raises appropriate error."""
        with pytest.raises(ValueError, match="Invalid vault path"):
            parser.get_vault_files(Path("/nonexistent/vault"))

    def test_get_vault_files_missing_obsidian_folder_raises_error(self, parser):
        """Test that vault without .obsidian folder raises error."""
        with tempfile.TemporaryDirectory() as temp_dir:
            vault_path = Path(temp_dir)
            # Don't create .obsidian folder
            
            with pytest.raises(ValueError, match="Not a valid Obsidian vault"):
                parser.get_vault_files(vault_path)

    def test_parse_file_extracts_wikilinks(self, parser, sample_vault):
        """Test that wikilinks are extracted as metadata."""
        note1_path = sample_vault / "note1.md"
        result = parser.parse_file(note1_path)
        
        # Should extract wikilinks as metadata
        assert 'wikilinks' in result['metadata']
        assert 'linked note' in result['metadata']['wikilinks']

    def test_parse_file_extracts_tags_from_content(self, parser, sample_vault):
        """Test that #tags in content are extracted."""
        # Create a file with content tags
        content_with_tags = """# Note with tags

This note has #important and #project/work tags.
"""
        note_path = sample_vault / "tagged_note.md"
        note_path.write_text(content_with_tags)
        
        result = parser.parse_file(note_path)
        
        # Should extract content tags
        assert 'content_tags' in result['metadata']
        assert 'important' in result['metadata']['content_tags']
        assert 'project/work' in result['metadata']['content_tags']

    def test_parse_file_calculates_word_count(self, parser, sample_vault):
        """Test that word count is calculated correctly."""
        note1_path = sample_vault / "note1.md"
        result = parser.parse_file(note1_path)
        
        assert 'word_count' in result['metadata']
        assert result['metadata']['word_count'] > 0
        assert isinstance(result['metadata']['word_count'], int)

    def test_parse_file_includes_file_metadata(self, parser, sample_vault):
        """Test that file system metadata is included."""
        note1_path = sample_vault / "note1.md"
        result = parser.parse_file(note1_path)
        
        assert result['file_path'] == str(note1_path)
        assert 'modified_time' in result['metadata']
        assert 'file_size' in result['metadata']