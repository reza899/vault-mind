import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ResultCard from '../ResultCard';
import { SearchResult } from '@/types';

const mockResult: SearchResult = {
  content: 'This is a test content with some interesting information about machine learning and AI.',
  metadata: {
    file_path: '/vault/documents/test-file.md',
    chunk_index: 0,
    file_type: 'md',
    created_at: '2024-01-01T10:00:00Z',
    modified_at: '2024-01-02T15:30:00Z',
    tags: ['ai', 'ml', 'notes'],
  },
  similarity_score: 0.85,
};

const mockOnCopy = vi.fn();

const defaultProps = {
  result: mockResult,
  query: 'machine learning',
  onCopy: mockOnCopy,
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ResultCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders result content correctly', () => {
    render(<ResultCard {...defaultProps} />);
    
    expect(screen.getByText(/This is a test content/)).toBeInTheDocument();
    expect(screen.getByText('test-file.md')).toBeInTheDocument();
    expect(screen.getByText('/vault/documents/test-file.md')).toBeInTheDocument();
  });

  it('displays similarity score as percentage', () => {
    render(<ResultCard {...defaultProps} />);
    
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('highlights search terms in content', () => {
    render(<ResultCard {...defaultProps} />);
    
    const highlightedText = screen.getByText('machine learning');
    expect(highlightedText.closest('mark')).toBeInTheDocument();
  });

  it('shows formatted date', () => {
    render(<ResultCard {...defaultProps} />);
    
    expect(screen.getByText('Jan 2, 2024')).toBeInTheDocument();
  });

  it('displays tags when available', () => {
    render(<ResultCard {...defaultProps} />);
    
    expect(screen.getByText('ai, ml, notes')).toBeInTheDocument();
  });

  it('shows chunk index', () => {
    render(<ResultCard {...defaultProps} />);
    
    expect(screen.getByText('Chunk 1')).toBeInTheDocument();
  });

  it('truncates long content and shows expand button', () => {
    const longContent = 'A'.repeat(400);
    const longResult = { ...mockResult, content: longContent };
    
    render(<ResultCard {...defaultProps} result={longResult} />);
    
    const expandButton = screen.getByText('Show more');
    expect(expandButton).toBeInTheDocument();
    
    // Content should be truncated
    const displayedContent = screen.getByText(/A+\.\.\./);
    expect(displayedContent).toBeInTheDocument();
  });

  it('expands content when expand button is clicked', async () => {
    const user = userEvent.setup();
    const longContent = 'A'.repeat(400);
    const longResult = { ...mockResult, content: longContent };
    
    render(<ResultCard {...defaultProps} result={longResult} />);
    
    const expandButton = screen.getByText('Show more');
    await user.click(expandButton);
    
    expect(screen.getByText('Show less')).toBeInTheDocument();
    // Full content should be visible (no ellipsis)
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
  });

  it('collapses content when collapse button is clicked', async () => {
    const user = userEvent.setup();
    const longContent = 'A'.repeat(400);
    const longResult = { ...mockResult, content: longContent };
    
    render(<ResultCard {...defaultProps} result={longResult} />);
    
    // Expand first
    await user.click(screen.getByText('Show more'));
    
    // Then collapse
    await user.click(screen.getByText('Show less'));
    
    expect(screen.getByText('Show more')).toBeInTheDocument();
    expect(screen.getByText(/A+\.\.\./)).toBeInTheDocument();
  });

  it('copies content to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    render(<ResultCard {...defaultProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockResult.content);
    expect(mockOnCopy).toHaveBeenCalledWith(mockResult.content);
  });

  it('shows copy feedback states', async () => {
    const user = userEvent.setup();
    render(<ResultCard {...defaultProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    
    // Initial state
    expect(screen.getByText('Copy')).toBeInTheDocument();
    
    // Click to copy
    await user.click(copyButton);
    
    // Should show "Copied!" temporarily
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
    
    // Should return to "Copy" after timeout
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles copy failure gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
    
    // Mock clipboard failure
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'));
    
    render(<ResultCard {...defaultProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy text:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('prevents multiple copy operations when already copying', async () => {
    const user = userEvent.setup();
    // Make clipboard operation slow
    (navigator.clipboard.writeText as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<ResultCard {...defaultProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    
    // Click multiple times quickly
    await user.click(copyButton);
    await user.click(copyButton);
    await user.click(copyButton);
    
    // Should only call clipboard once
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it('renders without tags when not available', () => {
    const resultWithoutTags = {
      ...mockResult,
      metadata: { ...mockResult.metadata, tags: undefined }
    };
    
    render(<ResultCard {...defaultProps} result={resultWithoutTags} />);
    
    // Tag icon and text should not be present
    expect(screen.queryByText('ai, ml, notes')).not.toBeInTheDocument();
  });

  it('renders without date when not available', () => {
    const resultWithoutDate = {
      ...mockResult,
      metadata: { 
        ...mockResult.metadata, 
        modified_at: undefined,
        created_at: undefined
      }
    };
    
    render(<ResultCard {...defaultProps} result={resultWithoutDate} />);
    
    // Date should not be present
    expect(screen.queryByText('Jan 2, 2024')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ResultCard {...defaultProps} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});