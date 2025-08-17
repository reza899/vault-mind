"""
Text chunker for splitting documents into semantic chunks for vector storage.
Handles markdown structure, code blocks, and maintains context overlap.
"""
import re
from typing import Dict, List, Any


class TextChunker:
    """Intelligent text chunker that respects semantic boundaries."""
    
    def __init__(self, chunk_size: int = 1000, overlap: int = 200):
        """
        Initialize the text chunker.
        
        Args:
            chunk_size: Maximum characters per chunk
            overlap: Number of characters to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        
        # Patterns for semantic boundary detection
        self.sentence_endings = re.compile(r'[.!?]+\s+')
        self.paragraph_breaks = re.compile(r'\n\s*\n')
        self.heading_pattern = re.compile(r'^#{1,6}\s+.+$', re.MULTILINE)
        self.code_block_pattern = re.compile(r'```[\s\S]*?```')
        self.list_item_pattern = re.compile(r'^[-*+]\s+.+$|^\d+\.\s+.+$', re.MULTILINE)
        
        # Metadata tracking
        self._last_chunk_metadata = {}
    
    def chunk_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Split text into semantic chunks with overlap.
        
        Args:
            text: Text content to chunk
            
        Returns:
            List of chunk dictionaries with text and metadata
        """
        if not text or not text.strip():
            return []
        
        text = text.strip()
        
        # If text is smaller than chunk size, return as single chunk
        if len(text) <= self.chunk_size:
            return [{
                'text': text,
                'index': 0,
                'start_char': 0,
                'end_char': len(text)
            }]
        
        chunks = []
        start_pos = 0
        chunk_index = 0
        
        while start_pos < len(text):
            # Calculate end position for this chunk
            end_pos = min(start_pos + self.chunk_size, len(text))
            
            # Adjust end position to respect semantic boundaries
            chunk_text, actual_end_pos = self._extract_semantic_chunk(
                text, start_pos, end_pos
            )
            
            # Create chunk only if it has content
            if chunk_text.strip():
                chunk = {
                    'text': chunk_text.strip(),
                    'index': chunk_index,
                    'start_char': start_pos,
                    'end_char': actual_end_pos
                }
                
                chunks.append(chunk)
                chunk_index += 1
            
            # Calculate next start position with overlap
            if actual_end_pos >= len(text):
                break
            
            # Simple overlap calculation - ensure progress
            start_pos = max(actual_end_pos - self.overlap, start_pos + 1)
            
            # Safety check to prevent infinite loops
            if start_pos >= actual_end_pos:
                start_pos = actual_end_pos
        
        # Update metadata
        self._update_chunk_metadata(chunks, text)
        
        return chunks
    
    def chunk_document(self, document: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Chunk a document while preserving metadata.
        
        Args:
            document: Document dict with 'content', 'metadata', 'file_path'
            
        Returns:
            List of chunk dictionaries with preserved metadata
        """
        content = document.get('content', '')
        metadata = document.get('metadata', {})
        file_path = document.get('file_path', '')
        
        text_chunks = self.chunk_text(content)
        
        # Enhance chunks with document metadata
        document_chunks = []
        for chunk in text_chunks:
            document_chunk = {
                'text': chunk['text'],
                'metadata': {
                    **metadata,  # Preserve original metadata
                    'chunk_index': chunk['index'],
                    'total_chunks': len(text_chunks),
                    'start_char': chunk['start_char'],
                    'end_char': chunk['end_char'],
                    'file_path': file_path
                }
            }
            document_chunks.append(document_chunk)
        
        return document_chunks
    
    def get_chunk_metadata(self) -> Dict[str, Any]:
        """Get metadata about the last chunking operation."""
        return self._last_chunk_metadata.copy()
    
    def _extract_semantic_chunk(self, text: str, start_pos: int, max_end_pos: int) -> tuple[str, int]:
        """
        Extract a chunk respecting semantic boundaries.
        
        Returns:
            Tuple of (chunk_text, actual_end_position)
        """
        if start_pos >= len(text):
            return "", start_pos
        
        # If we're at the end, return as is
        if max_end_pos >= len(text):
            return text[start_pos:], len(text)
        
        # Try to find a good breaking point
        best_break = self._find_best_break_point(text, start_pos, max_end_pos)
        
        return text[start_pos:best_break], best_break
    
    def _find_best_break_point(self, text: str, start_pos: int, max_end_pos: int) -> int:
        """Find the best position to break the text."""
        # Check for code blocks first - don't break inside them
        code_blocks = list(self.code_block_pattern.finditer(text))
        for block in code_blocks:
            if block.start() <= start_pos < block.end() and block.end() <= len(text):
                # We're starting inside a code block, try to include the whole block
                if block.end() - start_pos <= self.chunk_size * 1.2:  # Allow 20% overflow for code blocks
                    return block.end()
            elif start_pos < block.start() < max_end_pos < block.end():
                # Would break inside a code block, break before it
                return block.start()
        
        search_start = max(start_pos, max_end_pos - 200)  # Look within last 200 chars
        search_text = text[search_start:max_end_pos]
        
        # Priority 1: End of paragraph
        paragraph_matches = list(self.paragraph_breaks.finditer(search_text))
        if paragraph_matches:
            last_para_end = paragraph_matches[-1].end()
            return search_start + last_para_end
        
        # Priority 2: End of sentence
        sentence_matches = list(self.sentence_endings.finditer(search_text))
        if sentence_matches:
            last_sentence_end = sentence_matches[-1].end()
            return search_start + last_sentence_end
        
        # Priority 3: End of line
        last_newline = search_text.rfind('\n')
        if last_newline != -1:
            return search_start + last_newline + 1
        
        # Priority 4: Word boundary
        words = search_text.split()
        if len(words) > 1:
            # Find the last complete word
            last_word_end = search_text.rfind(words[-1])
            if last_word_end > len(search_text) // 2:  # Ensure we're not cutting too much
                return search_start + last_word_end
        
        # Fallback: Use max position
        return max_end_pos
    
    def _find_overlap_boundary(self, text: str, start_pos: int, end_pos: int) -> int:
        """Find appropriate boundary for overlap start."""
        if start_pos >= end_pos:
            return end_pos
        
        # Look for sentence or paragraph boundary within overlap region
        overlap_text = text[start_pos:end_pos]
        
        # Find first sentence boundary
        sentence_match = self.sentence_endings.search(overlap_text)
        if sentence_match:
            boundary = start_pos + sentence_match.end()
            # Ensure we don't go beyond the original end
            return min(boundary, end_pos - 1)
        
        # Find first line break
        newline_pos = overlap_text.find('\n')
        if newline_pos != -1:
            boundary = start_pos + newline_pos + 1
            return min(boundary, end_pos - 1)
        
        # Find first word boundary
        space_pos = overlap_text.find(' ')
        if space_pos != -1:
            boundary = start_pos + space_pos + 1
            return min(boundary, end_pos - 1)
        
        # Fallback
        return start_pos
    
    def _update_chunk_metadata(self, chunks: List[Dict[str, Any]], original_text: str) -> None:
        """Update metadata about the chunking operation."""
        if not chunks:
            self._last_chunk_metadata = {}
            return
        
        total_chunk_chars = sum(len(chunk['text']) for chunk in chunks)
        
        self._last_chunk_metadata = {
            'total_chunks': len(chunks),
            'total_characters': len(original_text),
            'average_chunk_size': total_chunk_chars // len(chunks),
            'overlap_ratio': (total_chunk_chars - len(original_text)) / len(original_text) if len(original_text) > 0 else 0
        }