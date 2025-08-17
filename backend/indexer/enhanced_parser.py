"""
Enhanced markdown parser with advanced Obsidian features.
Extends basic parser with callouts, tasks, embeds, and more.
"""
import re
from pathlib import Path
from typing import Dict, Any

from .markdown_parser import MarkdownParser


class EnhancedMarkdownParser(MarkdownParser):
    """Enhanced parser for advanced Obsidian markdown features."""
    
    def __init__(self):
        """Initialize enhanced parser with additional patterns."""
        super().__init__()
        
        # Add method aliases for test compatibility
        self.parse_advanced_features = self.parse_file
        self.extract_callouts = self._extract_callouts
        self.extract_tasks = self._extract_tasks
        
        # Enhanced patterns for advanced features
        self.embed_pattern = re.compile(r'!\[\[([^\]]+)\]\]')
        self.callout_pattern = re.compile(r'> \[!(\w+)\](?:\s+(.+?))?\s*\n((?:> .+\s*\n)*)', re.MULTILINE | re.DOTALL)
        self.task_pattern = re.compile(r'- \[([x\s\-])\] (.+)', re.MULTILINE)
        self.math_block_pattern = re.compile(r'\$\$(.+?)\$\$', re.DOTALL)
        self.math_inline_pattern = re.compile(r'\$([^$]+)\$')
        self.code_block_pattern = re.compile(r'```(\w+)?\n(.*?)\n```', re.DOTALL)
        self.table_pattern = re.compile(r'^\|(.+?)\|\s*$\n^\|[-\s\|]+\|\s*$\n((?:^\|.+?\|\s*$\n?)+)', re.MULTILINE)
        self.dataview_pattern = re.compile(r'```dataview(js)?\n(.*?)\n```', re.DOTALL)
        self.heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        
        # Additional excluded folders
        self.excluded_folders.update({'templates'})
    
    def parse_file(self, file_path: Path) -> Dict[str, Any]:
        """Parse file with enhanced features."""
        # Get basic parsing result
        result = super().parse_file(file_path)
        
        # Add advanced feature extraction
        content = result['content']
        metadata = result['metadata']
        
        # Extract advanced features
        self._extract_embeds(content, metadata)
        self._extract_callouts(content, metadata)
        self._extract_tasks(content, metadata)
        self._extract_math_blocks(content, metadata)
        self._extract_code_blocks(content, metadata)
        self._extract_tables(content, metadata)
        self._extract_dataview_queries(content, metadata)
        self._extract_structure(content, metadata)
        
        # Recalculate word count excluding metadata blocks
        self._calculate_enhanced_word_count(content, metadata)
        
        return result
    
    def _extract_embeds(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract embedded files and notes."""
        embeds = self.embed_pattern.findall(content)
        if embeds:
            # Clean embeds (remove aliases if present)
            clean_embeds = []
            for embed in embeds:
                if '|' in embed:
                    embed = embed.split('|')[0]
                clean_embeds.append(embed.strip())
            metadata['embeds'] = list(set(clean_embeds))
    
    def _extract_callouts(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract Obsidian callouts."""
        callouts = []
        
        # Find callout blocks manually
        lines = content.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i]
            # Look for callout start pattern
            callout_match = re.match(r'> \[!(\w+)\](?:\s+(.+?))?\s*$', line)
            if callout_match:
                callout_type = callout_match.group(1)
                title = callout_match.group(2)
                
                # Collect content lines
                content_lines = []
                i += 1
                while i < len(lines) and lines[i].startswith('> '):
                    content_lines.append(lines[i][2:])  # Remove '> '
                    i += 1
                
                callout = {
                    'type': callout_type,
                    'title': title.strip() if title else None,
                    'content': '\n'.join(content_lines).strip()
                }
                callouts.append(callout)
            else:
                i += 1
        
        if callouts:
            metadata['callouts'] = callouts
    
    def _extract_tasks(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract tasks with different statuses."""
        tasks = []
        matches = self.task_pattern.findall(content)
        
        for match in matches:
            status_char, task_text = match
            
            # Map status characters to status names
            status_map = {
                ' ': 'incomplete',
                'x': 'complete',
                '-': 'cancelled'
            }
            
            task = {
                'status': status_map.get(status_char, 'unknown'),
                'text': task_text.strip()
            }
            tasks.append(task)
        
        if tasks:
            metadata['tasks'] = tasks
    
    def _extract_math_blocks(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract LaTeX math expressions."""
        math_blocks = []
        
        # Extract block math
        block_matches = self.math_block_pattern.findall(content)
        for match in block_matches:
            math_blocks.append({
                'type': 'block',
                'expression': match.strip()
            })
        
        # Extract inline math (but not those inside block math)
        content_without_blocks = self.math_block_pattern.sub('', content)
        inline_matches = self.math_inline_pattern.findall(content_without_blocks)
        for match in inline_matches:
            math_blocks.append({
                'type': 'inline',
                'expression': match.strip()
            })
        
        if math_blocks:
            metadata['math_blocks'] = math_blocks
    
    def _extract_code_blocks(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract code blocks with language detection."""
        code_blocks = []
        matches = self.code_block_pattern.findall(content)
        
        for match in matches:
            language, code = match
            code_block = {
                'language': language.strip() if language else 'text',
                'code': code.strip()
            }
            code_blocks.append(code_block)
        
        if code_blocks:
            metadata['code_blocks'] = code_blocks
    
    def _extract_tables(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract markdown tables."""
        tables = []
        
        # Find tables manually
        lines = content.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            # Look for table header (line with |)
            if '|' in line and line.startswith('|') and line.endswith('|'):
                # Extract headers
                headers = [h.strip() for h in line.split('|')[1:-1] if h.strip()]
                
                # Check if next line is separator
                if i + 1 < len(lines):
                    separator_line = lines[i + 1].strip()
                    if '|' in separator_line and re.match(r'^\|[-\s\|]+\|$', separator_line):
                        # Found table, collect data rows
                        rows = []
                        j = i + 2
                        while j < len(lines):
                            row_line = lines[j].strip()
                            if '|' in row_line and row_line.startswith('|') and row_line.endswith('|'):
                                row_cells = [c.strip() for c in row_line.split('|')[1:-1] if c.strip()]
                                if row_cells:
                                    rows.append(row_cells)
                                j += 1
                            else:
                                break
                        
                        if headers and rows:
                            table = {
                                'headers': headers,
                                'rows': rows
                            }
                            tables.append(table)
                        
                        i = j
                    else:
                        i += 1
                else:
                    i += 1
            else:
                i += 1
        
        if tables:
            metadata['tables'] = tables
    
    def _extract_dataview_queries(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract Dataview queries."""
        queries = []
        matches = self.dataview_pattern.findall(content)
        
        for match in matches:
            is_js, query_content = match
            query = {
                'type': 'dataviewjs' if is_js else 'dataview',
                'query': query_content.strip()
            }
            queries.append(query)
        
        if queries:
            metadata['dataview_queries'] = queries
    
    def _extract_structure(self, content: str, metadata: Dict[str, Any]) -> None:
        """Extract document structure (headings, sections)."""
        headings = []
        matches = self.heading_pattern.findall(content)
        
        for match in matches:
            hash_marks, heading_text = match
            heading = {
                'level': len(hash_marks),
                'text': heading_text.strip()
            }
            headings.append(heading)
        
        if headings:
            metadata['structure'] = {
                'headings': headings
            }
    
    def _calculate_enhanced_word_count(self, content: str, metadata: Dict[str, Any]) -> None:
        """Calculate word count excluding metadata blocks."""
        # Start with original content
        content_for_count = content
        
        # Remove code blocks
        content_for_count = self.code_block_pattern.sub('', content_for_count)
        
        # Remove math blocks
        content_for_count = self.math_block_pattern.sub('', content_for_count)
        content_for_count = self.math_inline_pattern.sub('', content_for_count)
        
        # Remove dataview queries
        content_for_count = self.dataview_pattern.sub('', content_for_count)
        
        # Remove callouts content (keep the text but remove markup)
        content_for_count = re.sub(r'> \[!\w+\].*?\n', '', content_for_count)
        content_for_count = re.sub(r'^> ', '', content_for_count, flags=re.MULTILINE)
        
        # Remove table markup but keep content
        content_for_count = re.sub(r'\|', ' ', content_for_count)
        content_for_count = re.sub(r'^[-\s\|]+$', '', content_for_count, flags=re.MULTILINE)
        
        # Apply basic word count logic from parent class
        content_for_count = re.sub(r'^#+\s', '', content_for_count, flags=re.MULTILINE)
        content_for_count = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content_for_count)
        content_for_count = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content_for_count)
        content_for_count = re.sub(r'\*\*([^\*]+)\*\*', r'\1', content_for_count)
        content_for_count = re.sub(r'\*([^\*]+)\*', r'\1', content_for_count)
        
        words = self.word_pattern.findall(content_for_count)
        metadata['word_count'] = len(words)