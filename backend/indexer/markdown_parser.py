"""
Markdown parser for Obsidian vault files.
Handles frontmatter, wikilinks, and metadata extraction.
"""
import os
import re
from pathlib import Path
from typing import Dict, List, Any
import frontmatter


class MarkdownParser:
    """Parser for Obsidian markdown files with frontmatter and metadata extraction."""
    
    def __init__(self):
        """Initialize the markdown parser."""
        # Patterns for extracting various elements
        self.wikilink_pattern = re.compile(r'\[\[([^\]]+)\]\]')
        self.tag_pattern = re.compile(r'#([a-zA-Z0-9_/-]+)')
        self.word_pattern = re.compile(r'\b\w+\b')
        
        # Folders to exclude
        self.excluded_folders = {'.obsidian', '.trash'}
    
    def get_vault_files(self, vault_path: Path) -> List[Path]:
        """Get all markdown files in the vault, excluding .obsidian and .trash folders."""
        if not vault_path.exists():
            raise ValueError(f"Invalid vault path: {vault_path} does not exist")
        
        if not vault_path.is_dir():
            raise ValueError(f"Invalid vault path: {vault_path} is not a directory")
        
        # Check if it's a valid Obsidian vault (must have .obsidian folder)
        obsidian_folder = vault_path / ".obsidian"
        if not obsidian_folder.exists():
            raise ValueError(f"Not a valid Obsidian vault: missing .obsidian folder in {vault_path}")
        
        markdown_files = []
        
        # Walk through all directories and files
        for root, dirs, files in os.walk(vault_path):
            root_path = Path(root)
            
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in self.excluded_folders]
            
            # Find markdown files
            for file in files:
                if file.endswith('.md'):
                    file_path = root_path / file
                    markdown_files.append(file_path)
        
        return sorted(markdown_files)
    
    def parse_file(self, file_path: Path) -> Dict[str, Any]:
        """Parse a single markdown file and extract content and metadata."""
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Read and parse the file with frontmatter
        with open(file_path, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
        
        # Extract content and metadata
        content = post.content
        metadata = dict(post.metadata) if post.metadata else {}
        
        # Extract additional metadata from content
        self._extract_content_metadata(content, metadata)
        
        # Add file system metadata
        self._add_file_metadata(file_path, metadata)
        
        return {
            'content': content,
            'metadata': metadata,
            'file_path': str(file_path)
        }
    
    def _extract_content_metadata(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract metadata from markdown content."""
        # Extract wikilinks
        wikilinks = self.wikilink_pattern.findall(content)
        if wikilinks:
            # Clean wikilinks (remove aliases if present)
            clean_links = []
            for link in wikilinks:
                # Handle [[link|alias]] format
                if '|' in link:
                    link = link.split('|')[0]
                clean_links.append(link.strip())
            metadata['wikilinks'] = list(set(clean_links))
        
        # Extract content tags (hashtags)
        content_tags = self.tag_pattern.findall(content)
        if content_tags:
            metadata['content_tags'] = list(set(content_tags))
        
        # Calculate word count (excluding markdown syntax)
        # Remove code blocks first
        content_for_count = re.sub(r'```[\s\S]*?```', '', content)
        # Remove inline code
        content_for_count = re.sub(r'`[^`]*`', '', content_for_count)
        # Remove markdown headers
        content_for_count = re.sub(r'^#+\s', '', content_for_count, flags=re.MULTILINE)
        # Remove markdown links
        content_for_count = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content_for_count)
        # Remove wikilinks for counting
        content_for_count = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content_for_count)
        # Remove bold and italic markers
        content_for_count = re.sub(r'\*\*([^\*]+)\*\*', r'\1', content_for_count)
        content_for_count = re.sub(r'\*([^\*]+)\*', r'\1', content_for_count)
        
        words = self.word_pattern.findall(content_for_count)
        metadata['word_count'] = len(words)
    
    def _add_file_metadata(self, file_path: Path, metadata: Dict[str, Any]) -> None:
        """Add file system metadata."""
        stat_info = file_path.stat()
        metadata['modified_time'] = stat_info.st_mtime
        metadata['file_size'] = stat_info.st_size