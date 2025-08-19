interface SearchResult {
  content: string;
  metadata: {
    file_path: string;
    chunk_index: number;
    file_type: string;
    created_at?: string;
    modified_at?: string;
    tags?: string[];
  };
  similarity_score: number;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  includeTimestamp?: boolean;
  includeQuery?: boolean;
  query?: string;
  vaultName?: string;
  customFilename?: string;
}

/**
 * Export search results to JSON format
 */
export const exportToJSON = (
  results: SearchResult[], 
  options: ExportOptions = {}
): void => {
  const { 
    includeMetadata = true, 
    includeTimestamp = true, 
    includeQuery = true,
    query,
    vaultName,
    customFilename
  } = options;

  const exportData = {
    ...(includeQuery && query && { query }),
    ...(includeQuery && vaultName && { vault: vaultName }),
    ...(includeTimestamp && { exported_at: new Date().toISOString() }),
    total_results: results.length,
    results: results.map((result, index) => ({
      index: index + 1,
      content: result.content,
      similarity_score: result.similarity_score,
      ...(includeMetadata && {
        metadata: {
          file_path: result.metadata.file_path,
          chunk_index: result.metadata.chunk_index,
          file_type: result.metadata.file_type,
          ...(result.metadata.created_at && { created_at: result.metadata.created_at }),
          ...(result.metadata.modified_at && { modified_at: result.metadata.modified_at }),
          ...(result.metadata.tags && result.metadata.tags.length > 0 && { tags: result.metadata.tags }),
        }
      })
    }))
  };

  const filename = customFilename || generateFilename('json', query, vaultName);
  downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
};

/**
 * Export search results to CSV format
 */
export const exportToCSV = (
  results: SearchResult[], 
  options: ExportOptions = {}
): void => {
  const { query, vaultName, customFilename } = options;

  // Define CSV headers
  const headers = [
    'Index',
    'File Path',
    'Content',
    'Similarity Score (%)',
    'File Type',
    'Chunk Index',
    'Tags',
    'Created At',
    'Modified At'
  ];

  // Convert results to CSV rows
  const rows = results.map((result, index) => [
    index + 1,
    result.metadata.file_path,
    `"${result.content.replace(/"/g, '""')}"`, // Escape quotes in content
    (result.similarity_score * 100).toFixed(2),
    result.metadata.file_type,
    result.metadata.chunk_index,
    (result.metadata.tags || []).join('; '),
    result.metadata.created_at || '',
    result.metadata.modified_at || ''
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');

  const filename = customFilename || generateFilename('csv', query, vaultName);
  downloadFile(csvContent, filename, 'text/csv');
};

/**
 * Export search results to Markdown format
 */
export const exportToMarkdown = (
  results: SearchResult[], 
  options: ExportOptions = {}
): void => {
  const { 
    includeMetadata = true, 
    includeTimestamp = true, 
    includeQuery = true,
    query,
    vaultName,
    customFilename
  } = options;

  let markdown = '';

  // Header
  if (includeQuery && (query || vaultName)) {
    markdown += '# Search Results\n\n';
    if (query) {
      markdown += `**Query:** \`${query}\`\n\n`;
    }
    if (vaultName) {
      markdown += `**Vault:** ${vaultName}\n\n`;
    }
  }

  if (includeTimestamp) {
    markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
  }

  markdown += `**Total Results:** ${results.length}\n\n`;
  markdown += '---\n\n';

  // Results
  results.forEach((result, index) => {
    markdown += `## Result ${index + 1}\n\n`;
    
    if (includeMetadata) {
      markdown += `**File:** \`${result.metadata.file_path}\`\n\n`;
      markdown += `**Similarity:** ${(result.similarity_score * 100).toFixed(1)}%\n\n`;
      
      if (result.metadata.file_type) {
        markdown += `**Type:** ${result.metadata.file_type}\n\n`;
      }
      
      if (result.metadata.tags && result.metadata.tags.length > 0) {
        markdown += `**Tags:** ${result.metadata.tags.map(tag => `\`${tag}\``).join(', ')}\n\n`;
      }
      
      if (result.metadata.created_at || result.metadata.modified_at) {
        markdown += '**Dates:**\n';
        if (result.metadata.created_at) {
          markdown += `- Created: ${new Date(result.metadata.created_at).toLocaleString()}\n`;
        }
        if (result.metadata.modified_at) {
          markdown += `- Modified: ${new Date(result.metadata.modified_at).toLocaleString()}\n`;
        }
        markdown += '\n';
      }
    }

    // Content
    markdown += '### Content\n\n';
    markdown += '```\n';
    markdown += result.content;
    markdown += '\n```\n\n';
    
    if (index < results.length - 1) {
      markdown += '---\n\n';
    }
  });

  const filename = customFilename || generateFilename('md', query, vaultName);
  downloadFile(markdown, filename, 'text/markdown');
};

/**
 * Generate a filename for export
 */
const generateFilename = (
  format: 'json' | 'csv' | 'md',
  query?: string,
  vaultName?: string
): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const safeName = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 30);
  
  let filename = 'search_results';
  
  if (vaultName) {
    filename += `_${safeName(vaultName)}`;
  }
  
  if (query) {
    filename += `_${safeName(query)}`;
  }
  
  filename += `_${timestamp}.${format}`;
  
  return filename;
};

/**
 * Download a file with the given content
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Share search results via URL (for web sharing)
 */
export const shareSearchResults = async (
  results: SearchResult[],
  query?: string,
  vaultName?: string
): Promise<string> => {
  // Create a shareable data structure
  const shareData = {
    query,
    vault: vaultName,
    timestamp: new Date().toISOString(),
    results: results.map(result => ({
      content: result.content,
      file_path: result.metadata.file_path,
      similarity_score: result.similarity_score
    }))
  };

  // Compress and encode the data
  const jsonString = JSON.stringify(shareData);
  const encoded = btoa(encodeURIComponent(jsonString));
  
  // Create shareable URL (this would typically use a URL shortener or backend service)
  const shareUrl = `${window.location.origin}/shared-search?data=${encoded}`;
  
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(shareUrl);
    return shareUrl;
  } catch (error) {
    console.error('Failed to copy share URL:', error);
    throw new Error('Failed to create share URL');
  }
};

/**
 * Save search results to local storage for later access
 */
export const saveSearchResults = (
  results: SearchResult[],
  query?: string,
  vaultName?: string,
  name?: string
): string => {
  const saveData = {
    id: generateSaveId(),
    name: name || `Search: ${query || 'Untitled'}`,
    query,
    vault: vaultName,
    saved_at: new Date().toISOString(),
    results
  };

  // Get existing saved searches
  const existingSaves = getSavedSearches();
  existingSaves.push(saveData);
  
  // Keep only the last 20 saves
  const trimmedSaves = existingSaves.slice(-20);
  
  try {
    localStorage.setItem('vault-mind-saved-searches', JSON.stringify(trimmedSaves));
    return saveData.id;
  } catch (error) {
    console.error('Failed to save search results:', error);
    throw new Error('Failed to save search results');
  }
};

/**
 * Get all saved search results
 */
export const getSavedSearches = (): Array<{
  id: string;
  name: string;
  query?: string;
  vault?: string;
  saved_at: string;
  results: SearchResult[];
}> => {
  try {
    const saved = localStorage.getItem('vault-mind-saved-searches');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * Delete a saved search
 */
export const deleteSavedSearch = (id: string): void => {
  const saves = getSavedSearches().filter(save => save.id !== id);
  localStorage.setItem('vault-mind-saved-searches', JSON.stringify(saves));
};

/**
 * Generate a unique save ID
 */
const generateSaveId = (): string => {
  return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Export all functionality
export const searchExportUtils = {
  exportToJSON,
  exportToCSV,
  exportToMarkdown,
  shareSearchResults,
  saveSearchResults,
  getSavedSearches,
  deleteSavedSearch
};