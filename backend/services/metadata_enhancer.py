"""
Metadata Enhancement Service - Advanced metadata processing and storage for ChromaDB.
Provides sophisticated metadata handling, indexing, and querying capabilities.
"""
import json
import logging
from typing import Dict, List, Any, Union
from datetime import datetime
from pathlib import Path
import hashlib
import re

logger = logging.getLogger(__name__)


class MetadataEnhancer:
    """Enhanced metadata processor for optimized ChromaDB storage and retrieval."""
    
    def __init__(self):
        """Initialize the metadata enhancer."""
        # Define metadata categories for organization
        self.metadata_categories = {
            'content': ['word_count', 'char_count', 'link_density', 'content_tags', 'language'],
            'structure': ['headings', 'tables', 'code_blocks', 'math_blocks', 'callouts'],
            'file': ['file_path', 'file_size', 'created_at', 'modified_at', 'file_extension'],
            'vault': ['vault_name', 'vault_path', 'collection_name'],
            'processing': ['indexed_at', 'chunk_index', 'total_chunks', 'parser_version'],
            'links': ['wikilinks', 'backlinks', 'external_links', 'internal_links'],
            'semantic': ['topics', 'entities', 'concepts', 'sentiment']
        }
        
        # Define metadata types for proper storage
        self.metadata_types = {
            'string': ['file_path', 'vault_name', 'language', 'file_extension'],
            'integer': ['word_count', 'char_count', 'chunk_index', 'total_chunks', 'file_size'],
            'float': ['link_density', 'sentiment_score'],
            'boolean': ['has_images', 'has_links', 'is_empty', 'is_template'],
            'datetime': ['indexed_at', 'created_at', 'modified_at'],
            'list': ['content_tags', 'topics', 'entities', 'headings', 'wikilinks'],
            'json': ['link_stats', 'structure', 'callouts', 'code_blocks']
        }
        
        # ChromaDB compatible value limits
        self.max_string_length = 8000
        self.max_list_items = 1000
        
    def enhance_metadata(self, raw_metadata: Dict[str, Any], content: str = "") -> Dict[str, Any]:
        """
        Enhance raw metadata with additional processing and optimization.
        
        Args:
            raw_metadata: Original metadata from parser
            content: Document content for additional analysis
            
        Returns:
            Enhanced and optimized metadata
        """
        enhanced = {}
        
        # Start with sanitized raw metadata
        sanitized = self._sanitize_for_chromadb(raw_metadata)
        enhanced.update(sanitized)
        
        # Add computed metadata
        enhanced.update(self._compute_content_metrics(content, raw_metadata))
        enhanced.update(self._extract_semantic_features(content, raw_metadata))
        enhanced.update(self._generate_search_metadata(content, raw_metadata))
        enhanced.update(self._add_categorization(raw_metadata))
        
        # Add metadata fingerprint for change detection
        enhanced['metadata_fingerprint'] = self._generate_metadata_fingerprint(enhanced)
        enhanced['metadata_enhanced_at'] = datetime.now().isoformat()
        enhanced['metadata_version'] = '2.0'
        
        # Validate and clean final metadata
        return self._validate_enhanced_metadata(enhanced)
    
    def _sanitize_for_chromadb(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize metadata for ChromaDB compatibility with enhanced processing.
        
        ChromaDB requirements:
        - Only str, int, float, bool, or None as values
        - Lists must be converted to strings
        - Complex objects must be serialized
        """
        sanitized = {}
        
        for key, value in metadata.items():
            # Skip None values
            if value is None:
                continue
            
            # Sanitize key name
            clean_key = self._sanitize_key_name(key)
            
            # Process based on value type
            if isinstance(value, (str, int, float, bool)):
                sanitized[clean_key] = self._sanitize_primitive_value(value)
            elif isinstance(value, list):
                sanitized[clean_key] = self._sanitize_list_value(value, clean_key)
            elif isinstance(value, dict):
                sanitized[clean_key] = self._sanitize_dict_value(value, clean_key)
            elif isinstance(value, datetime):
                sanitized[clean_key] = value.isoformat()
            else:
                # Convert other types to string
                sanitized[clean_key] = str(value)[:self.max_string_length]
        
        return sanitized
    
    def _sanitize_key_name(self, key: str) -> str:
        """Sanitize metadata key name for ChromaDB."""
        # Replace problematic characters
        clean_key = re.sub(r'[^\w_]', '_', key)
        
        # Ensure it starts with letter or underscore
        if clean_key and not clean_key[0].isalpha() and clean_key[0] != '_':
            clean_key = f"_{clean_key}"
        
        # Limit length
        return clean_key[:100]
    
    def _sanitize_primitive_value(self, value: Union[str, int, float, bool]) -> Union[str, int, float, bool]:
        """Sanitize primitive values."""
        if isinstance(value, str):
            # Limit string length
            return value[:self.max_string_length]
        return value
    
    def _sanitize_list_value(self, value: List[Any], key: str) -> str:
        """Sanitize list values by converting to delimited string."""
        if not value:
            return ""
        
        # Limit number of items
        limited_value = value[:self.max_list_items]
        
        # Convert all items to strings and join
        try:
            # Special handling for certain metadata types
            if key in ['content_tags', 'topics', 'entities']:
                # Use comma separation for tag-like data
                str_items = [str(item).strip() for item in limited_value if item]
                return ", ".join(str_items)
            elif key in ['headings']:
                # Use pipe separation for hierarchical data
                str_items = [str(item).strip() for item in limited_value if item]
                return " | ".join(str_items)
            else:
                # Default comma separation
                str_items = [str(item) for item in limited_value]
                result = ", ".join(str_items)
                return result[:self.max_string_length]
        except Exception:
            # Fallback to simple string conversion
            return str(limited_value)[:self.max_string_length]
    
    def _sanitize_dict_value(self, value: Dict[str, Any], key: str) -> str:
        """Sanitize dictionary values by converting to JSON string."""
        try:
            # For certain keys, extract specific fields
            if key == 'link_stats':
                # Extract just the counts
                return f"total:{value.get('total_outgoing_links', 0)}, external:{value.get('external_link_count', 0)}, internal:{value.get('internal_link_count', 0)}"
            elif key == 'structure' and 'headings' in value:
                # Extract heading structure
                headings = value.get('headings', [])
                if headings:
                    return f"headings:{len(headings)}, levels:{len(set(h.get('level', 1) for h in headings))}"
            
            # Default JSON serialization
            json_str = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
            return json_str[:self.max_string_length]
        except Exception:
            # Fallback to string representation
            return str(value)[:self.max_string_length]
    
    def _compute_content_metrics(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Compute additional content-based metrics."""
        metrics = {}
        
        if content:
            # Character-based metrics
            metrics['char_count'] = len(content)
            metrics['line_count'] = content.count('\n') + 1
            metrics['paragraph_count'] = len([p for p in content.split('\n\n') if p.strip()])
            
            # Language detection hints
            metrics['has_code_patterns'] = bool(re.search(r'```|`[^`]+`', content))
            metrics['has_math_patterns'] = bool(re.search(r'\$[^$]+\$|\$\$[^$]*\$\$', content))
            metrics['has_url_patterns'] = bool(re.search(r'https?://\S+', content))
            metrics['has_email_patterns'] = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content))
            
            # Readability metrics (simple)
            words = content.split()
            if words:
                avg_word_length = sum(len(word.strip('.,!?;:"()[]{}')) for word in words) / len(words)
                metrics['avg_word_length'] = round(avg_word_length, 2)
            
            # Content complexity indicators
            metrics['has_tables'] = bool(re.search(r'\|.*\|', content))
            metrics['has_lists'] = bool(re.search(r'^\s*[-*+]\s', content, re.MULTILINE))
            metrics['has_numbered_lists'] = bool(re.search(r'^\s*\d+\.\s', content, re.MULTILINE))
        
        # File-based metrics from existing metadata
        if 'file_path' in metadata:
            file_path = Path(metadata['file_path'])
            metrics['file_extension'] = file_path.suffix.lower()
            metrics['file_name'] = file_path.stem
            metrics['folder_depth'] = len(file_path.parts) - 1
        
        return metrics
    
    def _extract_semantic_features(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Extract semantic features for improved search and categorization."""
        features = {}
        
        if content:
            # Simple topic indicators (could be enhanced with NLP)
            topics = self._extract_topics_from_content(content)
            if topics:
                features['detected_topics'] = ", ".join(topics[:20])  # Limit topics
            
            # Content type detection
            content_type = self._detect_content_type(content, metadata)
            if content_type:
                features['content_type'] = content_type
            
            # Document purpose detection
            purpose = self._detect_document_purpose(content, metadata)
            if purpose:
                features['document_purpose'] = purpose
        
        return features
    
    def _extract_topics_from_content(self, content: str) -> List[str]:
        """Extract potential topics from content using simple keyword analysis."""
        # Simple topic extraction based on frequent meaningful words
        # This could be enhanced with proper NLP libraries
        
        # Remove common words and short words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}
        
        # Extract words, filter and count
        words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())
        word_freq = {}
        
        for word in words:
            if word not in stop_words and len(word) >= 3:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Return most frequent words as topics
        topics = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [topic[0] for topic in topics[:10] if topic[1] >= 2]  # At least 2 occurrences
    
    def _detect_content_type(self, content: str, metadata: Dict[str, Any]) -> str:
        """Detect the type of content based on patterns."""
        content_lower = content.lower()
        
        # Check for specific patterns
        if '```' in content or 'function' in content_lower or 'class ' in content_lower:
            return 'code'
        elif re.search(r'\$[^$]+\$|\$\$[^$]*\$\$', content):
            return 'mathematical'
        elif re.search(r'\|.*\|.*\n.*\|.*\|', content):
            return 'tabular'
        elif '# ' in content and content.count('#') > 3:
            return 'structured_notes'
        elif re.search(r'^\s*[-*+]\s.*^\s*[-*+]\s', content, re.MULTILINE):
            return 'list_based'
        elif 'meeting' in content_lower or 'agenda' in content_lower:
            return 'meeting_notes'
        elif 'todo' in content_lower or 'task' in content_lower:
            return 'task_management'
        else:
            return 'general_notes'
    
    def _detect_document_purpose(self, content: str, metadata: Dict[str, Any]) -> str:
        """Detect the purpose of the document."""
        content_lower = content.lower()
        
        # Purpose indicators
        if any(word in content_lower for word in ['reference', 'documentation', 'guide', 'manual']):
            return 'reference'
        elif any(word in content_lower for word in ['project', 'plan', 'roadmap', 'milestone']):
            return 'planning'
        elif any(word in content_lower for word in ['idea', 'brainstorm', 'concept', 'thought']):
            return 'ideation'
        elif any(word in content_lower for word in ['research', 'study', 'analysis', 'findings']):
            return 'research'
        elif any(word in content_lower for word in ['daily', 'weekly', 'journal', 'diary']):
            return 'journaling'
        elif any(word in content_lower for word in ['template', 'format', 'structure']):
            return 'template'
        else:
            return 'general'
    
    def _generate_search_metadata(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Generate metadata specifically for enhanced search capabilities."""
        search_meta = {}
        
        # Search-optimized text snippets
        if content:
            # Extract first paragraph as summary
            first_paragraph = content.split('\n\n')[0].strip()
            if first_paragraph:
                search_meta['content_preview'] = first_paragraph[:200]
            
            # Extract key phrases (simple implementation)
            key_phrases = self._extract_key_phrases(content)
            if key_phrases:
                search_meta['key_phrases'] = ", ".join(key_phrases[:10])
        
        # Search-friendly tags
        all_tags = []
        
        # Add existing tags
        if 'content_tags' in metadata:
            if isinstance(metadata['content_tags'], list):
                all_tags.extend(metadata['content_tags'])
            elif isinstance(metadata['content_tags'], str):
                all_tags.extend(metadata['content_tags'].split(', '))
        
        if 'tags' in metadata:  # From frontmatter
            if isinstance(metadata['tags'], list):
                all_tags.extend(metadata['tags'])
            elif isinstance(metadata['tags'], str):
                all_tags.extend(metadata['tags'].split(', '))
        
        # Flatten hierarchical tags for search
        flattened_tags = set()
        for tag in all_tags:
            if '/' in tag:
                parts = tag.split('/')
                for i in range(len(parts)):
                    flattened_tags.add('/'.join(parts[:i+1]))
            else:
                flattened_tags.add(tag)
        
        if flattened_tags:
            search_meta['searchable_tags'] = ", ".join(sorted(flattened_tags))
        
        return search_meta
    
    def _extract_key_phrases(self, content: str) -> List[str]:
        """Extract key phrases from content for search optimization."""
        # Simple key phrase extraction
        # This could be enhanced with proper NLP
        
        # Find phrases in quotes or emphasis
        phrases = []
        
        # Quoted phrases
        quoted = re.findall(r'"([^"]{5,50})"', content)
        phrases.extend(quoted)
        
        # Bold/italic phrases (markdown)
        emphasized = re.findall(r'\*\*([^*]{5,50})\*\*', content)
        phrases.extend(emphasized)
        
        emphasized = re.findall(r'\*([^*]{5,50})\*', content)
        phrases.extend(emphasized)
        
        # Clean and return unique phrases
        cleaned_phrases = []
        for phrase in phrases:
            cleaned = phrase.strip().lower()
            if len(cleaned) >= 5 and cleaned not in cleaned_phrases:
                cleaned_phrases.append(cleaned)
        
        return cleaned_phrases[:10]
    
    def _add_categorization(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Add categorization metadata for organization."""
        categorization = {}
        
        # Categorize metadata fields
        for category, fields in self.metadata_categories.items():
            category_data = []
            for field in fields:
                if field in metadata:
                    category_data.append(f"{field}:{type(metadata[field]).__name__}")
            
            if category_data:
                categorization[f'{category}_fields'] = ", ".join(category_data)
        
        # Add overall metadata richness score
        richness_score = len([k for k in metadata.keys() if metadata.get(k)])
        categorization['metadata_richness'] = richness_score
        
        return categorization
    
    def _generate_metadata_fingerprint(self, metadata: Dict[str, Any]) -> str:
        """Generate a fingerprint for metadata change detection."""
        # Create a hash of significant metadata fields
        significant_fields = ['file_path', 'word_count', 'content_tags', 'links', 'structure']
        
        fingerprint_data = {}
        for field in significant_fields:
            if field in metadata:
                fingerprint_data[field] = metadata[field]
        
        # Generate hash
        fingerprint_str = json.dumps(fingerprint_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(fingerprint_str.encode('utf-8')).hexdigest()
    
    def _validate_enhanced_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean the enhanced metadata."""
        validated = {}
        
        for key, value in metadata.items():
            # Skip empty values
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            
            # Validate key format
            clean_key = self._sanitize_key_name(key)
            if not clean_key:
                continue
            
            # Validate value types
            if isinstance(value, str):
                # Ensure string length limit
                validated[clean_key] = value[:self.max_string_length]
            elif isinstance(value, (int, float, bool)):
                validated[clean_key] = value
            else:
                # Convert to string if not compatible type
                validated[clean_key] = str(value)[:self.max_string_length]
        
        return validated
    
    def create_search_filters(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Create optimized filters for ChromaDB queries based on metadata."""
        filters = {}
        
        # File-based filters
        if 'file_extension' in metadata:
            filters['file_extension'] = metadata['file_extension']
        
        if 'content_type' in metadata:
            filters['content_type'] = metadata['content_type']
        
        # Size-based filters
        if 'word_count' in metadata:
            word_count = metadata['word_count']
            if word_count < 100:
                filters['content_size'] = 'small'
            elif word_count < 500:
                filters['content_size'] = 'medium'
            else:
                filters['content_size'] = 'large'
        
        # Feature-based filters
        feature_flags = []
        for flag in ['has_code_patterns', 'has_math_patterns', 'has_tables', 'has_lists']:
            if metadata.get(flag):
                feature_flags.append(flag.replace('has_', '').replace('_patterns', ''))
        
        if feature_flags:
            filters['content_features'] = ", ".join(feature_flags)
        
        return filters