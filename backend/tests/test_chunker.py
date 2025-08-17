import pytest

from indexer.text_chunker import TextChunker


class TestTextChunker:
    """Test the TextChunker for splitting documents into semantic chunks."""
    
    @pytest.fixture
    def chunker(self):
        """Create a TextChunker instance with default settings."""
        return TextChunker(chunk_size=100, overlap=20)
    
    @pytest.fixture
    def large_chunker(self):
        """Create a TextChunker with larger chunk size for testing."""
        return TextChunker(chunk_size=500, overlap=50)
    
    @pytest.fixture
    def sample_text(self):
        """Create sample text for chunking tests."""
        return """# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.

## Types of Machine Learning

### Supervised Learning
Supervised learning uses labeled data to train models. Common algorithms include:
- Linear regression
- Decision trees
- Neural networks

### Unsupervised Learning
Unsupervised learning finds patterns in unlabeled data. Examples include:
- Clustering algorithms
- Dimensionality reduction
- Anomaly detection

## Applications
Machine learning has many real-world applications:
1. Image recognition
2. Natural language processing
3. Recommendation systems
4. Autonomous vehicles

## Conclusion
Machine learning continues to evolve and transform various industries."""

    def test_chunker_initialization(self, chunker):
        """Test chunker initializes with correct parameters."""
        assert chunker is not None
        assert hasattr(chunker, 'chunk_text')
        assert hasattr(chunker, 'chunk_document')
        assert hasattr(chunker, 'get_chunk_metadata')
        assert chunker.chunk_size == 100
        assert chunker.overlap == 20

    def test_basic_text_chunking(self, chunker, sample_text):
        """Test basic text chunking functionality."""
        chunks = chunker.chunk_text(sample_text)
        
        assert len(chunks) > 1  # Should split into multiple chunks
        assert all(isinstance(chunk, dict) for chunk in chunks)
        
        # Check required fields
        for chunk in chunks:
            assert 'text' in chunk
            assert 'index' in chunk
            assert 'start_char' in chunk
            assert 'end_char' in chunk

    def test_chunk_size_respected(self, chunker, sample_text):
        """Test that chunks respect maximum size constraints."""
        chunks = chunker.chunk_text(sample_text)
        
        for chunk in chunks:
            # Chunks should not exceed the specified size (with some tolerance for word boundaries)
            assert len(chunk['text']) <= chunker.chunk_size + 50  # 50 char tolerance

    def test_chunk_overlap(self, chunker, sample_text):
        """Test that consecutive chunks have appropriate overlap."""
        chunks = chunker.chunk_text(sample_text)
        
        if len(chunks) > 1:
            for i in range(len(chunks) - 1):
                current_chunk = chunks[i]
                next_chunk = chunks[i + 1]
                
                # Check for overlap in character positions
                overlap_start = next_chunk['start_char']
                current_end = current_chunk['end_char']
                
                # There should be some overlap or reasonable proximity
                gap = overlap_start - current_end
                assert gap <= chunker.overlap  # Gap should not exceed overlap setting

    def test_semantic_boundary_respect(self, chunker):
        """Test that chunker respects semantic boundaries (sentences, paragraphs)."""
        text_with_clear_boundaries = """First paragraph with complete sentences. This is another sentence in the first paragraph.

Second paragraph starts here. It also has multiple sentences for testing.

Third paragraph is shorter."""
        
        chunks = chunker.chunk_text(text_with_clear_boundaries)
        
        # Chunks should preferentially break at paragraph or sentence boundaries
        for chunk in chunks:
            chunk_text = chunk['text'].strip()
            # Chunks should end with proper punctuation when possible
            if len(chunk_text) > 0:
                last_char = chunk_text[-1]
                # Should end with sentence-ending punctuation or be at a natural break
                assert last_char in '.!?\n' or chunk == chunks[-1]

    def test_heading_preservation(self, chunker, sample_text):
        """Test that markdown headings are preserved with their content."""
        chunks = chunker.chunk_text(sample_text)
        
        # Find chunks with headings
        heading_chunks = [c for c in chunks if '#' in c['text']]
        
        for chunk in heading_chunks:
            # Headings should be at the beginning of chunks when possible
            lines = chunk['text'].strip().split('\n')
            first_line = lines[0].strip()
            if first_line.startswith('#'):
                # If chunk starts with heading, it should have some content after it
                assert len(lines) > 1 or len(chunk['text']) < chunker.chunk_size

    def test_code_block_preservation(self, chunker):
        """Test that code blocks are kept together when possible."""
        text_with_code = """Here's some Python code:

```python
def hello_world():
    print("Hello, World!")
    return "success"
```

This code demonstrates a simple function."""
        
        chunks = chunker.chunk_text(text_with_code)
        
        # Check if code block is preserved
        code_chunks = [c for c in chunks if '```' in c['text']]
        
        if code_chunks:
            # At least one chunk should contain complete code block
            complete_blocks = 0
            for chunk in code_chunks:
                code_start_count = chunk['text'].count('```')
                if code_start_count % 2 == 0 and code_start_count > 0:
                    complete_blocks += 1
            # Should have at least one complete code block or be split reasonably
            assert complete_blocks > 0 or len(code_chunks) > 1

    def test_list_preservation(self, chunker, sample_text):
        """Test that lists are kept together when possible."""
        chunks = chunker.chunk_text(sample_text)
        
        # Find chunks with list items
        list_chunks = [c for c in chunks if '-' in c['text'] or any(c['text'].strip().startswith(f'{i}.') for i in range(1, 10))]
        
        # Lists should be logically grouped when possible
        for chunk in list_chunks:
            text = chunk['text']
            if '-' in text:
                # If chunk contains list items, they should be complete
                lines = text.split('\n')
                list_lines = [line for line in lines if line.strip().startswith('-')]
                # List items should be complete lines
                for list_line in list_lines:
                    # List lines should contain meaningful content (more than just the marker)
                    assert len(list_line.strip()) > 2

    def test_chunk_document_with_metadata(self, chunker):
        """Test chunking a document with metadata preservation."""
        document = {
            'content': 'This is a test document with some content that should be chunked.',
            'metadata': {
                'title': 'Test Document',
                'tags': ['test', 'chunking'],
                'file_path': '/test/path.md'
            },
            'file_path': '/test/path.md'
        }
        
        chunks = chunker.chunk_document(document)
        
        assert len(chunks) > 0
        
        for chunk in chunks:
            # Each chunk should preserve original metadata
            assert 'metadata' in chunk
            assert chunk['metadata']['title'] == 'Test Document'
            assert chunk['metadata']['tags'] == ['test', 'chunking']
            assert chunk['metadata']['file_path'] == '/test/path.md'
            
            # Should have chunk-specific metadata
            assert 'chunk_index' in chunk['metadata']
            assert 'total_chunks' in chunk['metadata']
            assert 'start_char' in chunk['metadata']
            assert 'end_char' in chunk['metadata']

    def test_empty_text_handling(self, chunker):
        """Test handling of empty or very short text."""
        empty_text = ""
        short_text = "Hi."
        
        empty_chunks = chunker.chunk_text(empty_text)
        short_chunks = chunker.chunk_text(short_text)
        
        # Empty text should return empty list
        assert len(empty_chunks) == 0
        
        # Short text should return single chunk
        assert len(short_chunks) == 1
        assert short_chunks[0]['text'] == "Hi."

    def test_very_long_text(self, large_chunker):
        """Test handling of very long text that exceeds normal chunk sizes."""
        # Create very long text
        long_text = "This is a sentence. " * 100  # 2000+ characters
        
        chunks = large_chunker.chunk_text(long_text)
        
        assert len(chunks) > 1
        
        # Verify coverage of entire text
        total_chars = sum(len(chunk['text']) for chunk in chunks)
        # Should cover most of the original text (accounting for overlap)
        assert total_chars >= len(long_text) * 0.8

    def test_chunk_metadata_accuracy(self, chunker, sample_text):
        """Test that chunk metadata (positions, indices) is accurate."""
        chunks = chunker.chunk_text(sample_text)
        
        for i, chunk in enumerate(chunks):
            # Check index consistency
            assert chunk['index'] == i
            
            # Check character positions
            start_char = chunk['start_char']
            end_char = chunk['end_char']
            
            assert start_char >= 0
            assert end_char > start_char
            assert end_char <= len(sample_text)
            
            # Verify text is valid
            actual_text = chunk['text'].strip()
            
            # Should be very similar (accounting for boundary adjustments)
            assert len(actual_text) > 0
            assert actual_text in sample_text

    def test_different_chunk_sizes(self, sample_text):
        """Test chunking with different chunk sizes."""
        small_chunker = TextChunker(chunk_size=50, overlap=10)
        medium_chunker = TextChunker(chunk_size=200, overlap=40)
        large_chunker = TextChunker(chunk_size=1000, overlap=100)
        
        small_chunks = small_chunker.chunk_text(sample_text)
        medium_chunks = medium_chunker.chunk_text(sample_text)
        large_chunks = large_chunker.chunk_text(sample_text)
        
        # Smaller chunk size should produce more chunks
        assert len(small_chunks) >= len(medium_chunks)
        assert len(medium_chunks) >= len(large_chunks)

    def test_get_chunk_metadata(self, chunker, sample_text):
        """Test getting metadata about chunking results."""
        chunks = chunker.chunk_text(sample_text)
        metadata = chunker.get_chunk_metadata()
        
        assert 'total_chunks' in metadata
        assert 'total_characters' in metadata
        assert 'average_chunk_size' in metadata
        assert 'overlap_ratio' in metadata
        
        assert metadata['total_chunks'] == len(chunks)
        assert metadata['total_characters'] > 0
        assert metadata['average_chunk_size'] > 0
        # Overlap ratio might exceed 1 with very small chunks
        assert metadata['overlap_ratio'] >= 0

    def test_special_characters_handling(self, chunker):
        """Test handling of special characters and unicode."""
        special_text = """Testing special chars: @#$%^&*()
Unicode: 中文测试 العربية русский
Emojis: 🚀 📝 🔍 💡
Mathematical: ∑ ∫ α β γ Δ"""
        
        chunks = chunker.chunk_text(special_text)
        
        assert len(chunks) > 0
        
        # Should preserve special characters
        all_chunk_text = ''.join(chunk['text'] for chunk in chunks)
        assert '🚀' in all_chunk_text
        assert '中文' in all_chunk_text
        assert '∑' in all_chunk_text

    def test_whitespace_handling(self, chunker):
        """Test proper handling of whitespace and formatting."""
        text_with_whitespace = """

        This text has irregular    spacing.


        Multiple blank lines above and below.
        
        
        Tabs	and	spaces	mixed.
        """
        
        chunks = chunker.chunk_text(text_with_whitespace)
        
        for chunk in chunks:
            # Chunks should have reasonable whitespace (not excessive leading/trailing)
            text = chunk['text']
            assert not text.startswith('    ')  # No excessive leading spaces
            assert not text.endswith('    ')    # No excessive trailing spaces