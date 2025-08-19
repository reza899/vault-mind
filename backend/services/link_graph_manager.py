"""
Link Graph Manager - Manages wikilink relationships and backlinks.
Builds a comprehensive graph of note relationships for navigation and discovery.
"""
import logging
from typing import Dict, List, Any
from pathlib import Path
from collections import defaultdict
import networkx as nx

logger = logging.getLogger(__name__)


class LinkGraphManager:
    """Manages the link graph for a vault, including backlinks and relationship analysis."""
    
    def __init__(self):
        """Initialize the link graph manager."""
        self.graphs: Dict[str, nx.DiGraph] = {}  # Vault name -> graph
        self.backlink_cache: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}  # Vault -> Note -> Backlinks
        
    def build_vault_graph(self, vault_name: str, documents_metadata: List[Dict[str, Any]]) -> None:
        """Build the complete link graph for a vault."""
        # Create directed graph
        graph = nx.DiGraph()
        backlinks = defaultdict(list)
        
        # First pass: Add all notes as nodes
        for doc_meta in documents_metadata:
            # Ensure doc_meta is a dictionary
            if not isinstance(doc_meta, dict):
                continue
                
            file_path = doc_meta.get('file_path', '')
            if file_path:
                note_name = Path(file_path).stem
                graph.add_node(note_name, metadata=doc_meta)
        
        # Second pass: Add edges and build backlinks
        for doc_meta in documents_metadata:
            # Ensure doc_meta is a dictionary
            if not isinstance(doc_meta, dict):
                continue
                
            source_file = doc_meta.get('file_path', '')
            if not source_file:
                continue
                
            source_note = Path(source_file).stem
            links = doc_meta.get('links', {})
            
            # Process wikilinks
            for wikilink in links.get('wikilinks', []):
                target = wikilink['target']
                target_note = self._normalize_note_name(target)
                
                # Add edge to graph
                if target_note in graph.nodes:
                    graph.add_edge(source_note, target_note, 
                                 link_type='wikilink', 
                                 alias=wikilink.get('alias'),
                                 raw_text=wikilink.get('raw_text'))
                
                # Add to backlinks
                backlinks[target_note].append({
                    'source_note': source_note,
                    'source_file': source_file,
                    'link_type': 'wikilink',
                    'alias': wikilink.get('alias'),
                    'raw_text': wikilink.get('raw_text'),
                    'context': self._extract_link_context(doc_meta.get('content', ''), wikilink['raw_text'])
                })
            
            # Process heading references
            for heading_ref in links.get('heading_references', []):
                target_note = self._normalize_note_name(heading_ref['target_note'])
                heading = heading_ref['heading']
                
                if target_note in graph.nodes:
                    graph.add_edge(source_note, target_note, 
                                 link_type='heading_reference',
                                 heading=heading,
                                 alias=heading_ref.get('alias'),
                                 raw_text=heading_ref.get('raw_text'))
                
                backlinks[target_note].append({
                    'source_note': source_note,
                    'source_file': source_file,
                    'link_type': 'heading_reference',
                    'heading': heading,
                    'alias': heading_ref.get('alias'),
                    'raw_text': heading_ref.get('raw_text'),
                    'context': self._extract_link_context(doc_meta.get('content', ''), heading_ref['raw_text'])
                })
            
            # Process block references
            for block_ref in links.get('block_references', []):
                target_note = self._normalize_note_name(block_ref['target_note'])
                block_id = block_ref['block_id']
                
                if target_note in graph.nodes:
                    graph.add_edge(source_note, target_note, 
                                 link_type='block_reference',
                                 block_id=block_id,
                                 alias=block_ref.get('alias'),
                                 raw_text=block_ref.get('raw_text'))
                
                backlinks[target_note].append({
                    'source_note': source_note,
                    'source_file': source_file,
                    'link_type': 'block_reference',
                    'block_id': block_id,
                    'alias': block_ref.get('alias'),
                    'raw_text': block_ref.get('raw_text'),
                    'context': self._extract_link_context(doc_meta.get('content', ''), block_ref['raw_text'])
                })
        
        # Store graph and backlinks
        self.graphs[vault_name] = graph
        self.backlink_cache[vault_name] = dict(backlinks)
        
        # Calculate graph metrics
        self._calculate_graph_metrics(vault_name)
        
        logger.info(f"Built link graph for vault '{vault_name}': {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
    
    def get_backlinks(self, vault_name: str, note_name: str) -> List[Dict[str, Any]]:
        """Get all backlinks pointing to a specific note."""
        vault_backlinks = self.backlink_cache.get(vault_name, {})
        return vault_backlinks.get(note_name, [])
    
    def get_outgoing_links(self, vault_name: str, note_name: str) -> List[Dict[str, Any]]:
        """Get all outgoing links from a specific note."""
        graph = self.graphs.get(vault_name)
        if not graph or note_name not in graph.nodes:
            return []
        
        outgoing = []
        for target in graph.successors(note_name):
            edge_data = graph.get_edge_data(note_name, target)
            outgoing.append({
                'target_note': target,
                'link_type': edge_data.get('link_type'),
                'alias': edge_data.get('alias'),
                'heading': edge_data.get('heading'),
                'block_id': edge_data.get('block_id'),
                'raw_text': edge_data.get('raw_text')
            })
        
        return outgoing
    
    def get_connected_notes(self, vault_name: str, note_name: str, max_distance: int = 2) -> Dict[str, Any]:
        """Get notes connected within specified distance."""
        graph = self.graphs.get(vault_name)
        if not graph or note_name not in graph.nodes:
            return {'connected_notes': [], 'paths': []}
        
        # Use BFS to find connected notes within distance
        connected = {}
        paths = {}
        
        try:
            # Get shortest paths within max distance
            path_lengths = nx.single_source_shortest_path_length(graph.to_undirected(), note_name, cutoff=max_distance)
            
            for target, distance in path_lengths.items():
                if target != note_name and distance <= max_distance:
                    connected[target] = distance
                    try:
                        paths[target] = nx.shortest_path(graph.to_undirected(), note_name, target)
                    except nx.NetworkXNoPath:
                        paths[target] = []
        
        except Exception as e:
            logger.warning(f"Error calculating connected notes for {note_name}: {e}")
        
        return {
            'connected_notes': [{'note': note, 'distance': dist} for note, dist in connected.items()],
            'paths': paths
        }
    
    def get_most_linked_notes(self, vault_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get notes with the most incoming links (backlinks)."""
        vault_backlinks = self.backlink_cache.get(vault_name, {})
        
        link_counts = [(note, len(backlinks)) for note, backlinks in vault_backlinks.items()]
        link_counts.sort(key=lambda x: x[1], reverse=True)
        
        return [{'note': note, 'backlink_count': count} for note, count in link_counts[:limit]]
    
    def get_hub_notes(self, vault_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get notes with the most outgoing links (hubs)."""
        graph = self.graphs.get(vault_name)
        if not graph:
            return []
        
        out_degrees = [(node, graph.out_degree(node)) for node in graph.nodes()]
        out_degrees.sort(key=lambda x: x[1], reverse=True)
        
        return [{'note': note, 'outgoing_links': count} for note, count in out_degrees[:limit]]
    
    def find_orphan_notes(self, vault_name: str) -> List[str]:
        """Find notes with no incoming or outgoing links."""
        graph = self.graphs.get(vault_name)
        if not graph:
            return []
        
        orphans = []
        for node in graph.nodes():
            if graph.in_degree(node) == 0 and graph.out_degree(node) == 0:
                orphans.append(node)
        
        return orphans
    
    def get_link_suggestions(self, vault_name: str, note_name: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Suggest potential links based on graph structure and content similarity."""
        graph = self.graphs.get(vault_name)
        if not graph or note_name not in graph.nodes:
            return []
        
        suggestions = []
        
        # Find nodes that are connected to the same nodes (potential related topics)
        current_neighbors = set(graph.neighbors(note_name))
        
        for other_note in graph.nodes():
            if other_note == note_name:
                continue
                
            other_neighbors = set(graph.neighbors(other_note))
            common_neighbors = current_neighbors.intersection(other_neighbors)
            
            # Calculate similarity based on common neighbors
            if common_neighbors and other_note not in current_neighbors:
                similarity_score = len(common_neighbors) / max(len(current_neighbors), len(other_neighbors))
                suggestions.append({
                    'note': other_note,
                    'similarity_score': similarity_score,
                    'common_connections': list(common_neighbors),
                    'reason': 'shared_connections'
                })
        
        # Sort by similarity and limit
        suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
        return suggestions[:limit]
    
    def get_graph_stats(self, vault_name: str) -> Dict[str, Any]:
        """Get comprehensive statistics about the link graph."""
        graph = self.graphs.get(vault_name)
        vault_backlinks = self.backlink_cache.get(vault_name, {})
        
        if not graph:
            return {}
        
        # Basic graph metrics
        stats = {
            'total_notes': graph.number_of_nodes(),
            'total_links': graph.number_of_edges(),
            'orphan_notes': len(self.find_orphan_notes(vault_name)),
            'most_linked_note': None,
            'average_links_per_note': 0,
            'link_density': 0,
            'connected_components': 0
        }
        
        if stats['total_notes'] > 0:
            stats['average_links_per_note'] = stats['total_links'] / stats['total_notes']
            max_possible_links = stats['total_notes'] * (stats['total_notes'] - 1)
            if max_possible_links > 0:
                stats['link_density'] = stats['total_links'] / max_possible_links
        
        # Find most linked note
        if vault_backlinks:
            most_linked = max(vault_backlinks.items(), key=lambda x: len(x[1]))
            stats['most_linked_note'] = {
                'note': most_linked[0],
                'backlink_count': len(most_linked[1])
            }
        
        # Count connected components
        try:
            stats['connected_components'] = nx.number_weakly_connected_components(graph)
        except Exception:
            stats['connected_components'] = 0
        
        return stats
    
    def _normalize_note_name(self, note_name: str) -> str:
        """Normalize note name for consistent graph operations."""
        # Remove file extension and clean up
        if note_name.endswith('.md'):
            note_name = note_name[:-3]
        return note_name.strip()
    
    def _extract_link_context(self, content: str, link_text: str, context_chars: int = 100) -> str:
        """Extract surrounding context for a link."""
        try:
            # Find the link in content
            link_pos = content.find(link_text)
            if link_pos == -1:
                return ""
            
            # Extract context around the link
            start = max(0, link_pos - context_chars)
            end = min(len(content), link_pos + len(link_text) + context_chars)
            
            context = content[start:end].strip()
            
            # Clean up context (remove line breaks, excessive whitespace)
            context = ' '.join(context.split())
            
            return context
        except Exception:
            return ""
    
    def _calculate_graph_metrics(self, vault_name: str) -> None:
        """Calculate and store advanced graph metrics."""
        graph = self.graphs.get(vault_name)
        if not graph:
            return
        
        try:
            # Calculate centrality measures for important nodes
            if graph.number_of_nodes() > 0:
                # PageRank for importance
                pagerank = nx.pagerank(graph)
                
                # Betweenness centrality for bridge nodes
                betweenness = nx.betweenness_centrality(graph)
                
                # Store metrics in graph nodes
                for node in graph.nodes():
                    graph.nodes[node]['pagerank'] = pagerank.get(node, 0)
                    graph.nodes[node]['betweenness'] = betweenness.get(node, 0)
                    
                logger.info(f"Calculated graph metrics for vault '{vault_name}'")
        except Exception as e:
            logger.warning(f"Error calculating graph metrics for vault '{vault_name}': {e}")