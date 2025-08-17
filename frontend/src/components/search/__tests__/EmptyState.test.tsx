import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EmptyState from '../EmptyState';

const mockOnRetry = vi.fn();
const mockOnConfigureVault = vi.fn();

describe('EmptyState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no-query type', () => {
    it('renders start search message', () => {
      render(<EmptyState type="no-query" />);
      
      expect(screen.getByText('Start Your Search')).toBeInTheDocument();
      expect(screen.getByText(/Enter a search query above/)).toBeInTheDocument();
      expect(screen.getByText(/explain machine learning/)).toBeInTheDocument();
    });

    it('shows search tips', () => {
      render(<EmptyState type="no-query" />);
      
      expect(screen.getByText('💡 Tips:')).toBeInTheDocument();
      expect(screen.getByText(/meeting notes 2024/)).toBeInTheDocument();
      expect(screen.getByText(/TODO/)).toBeInTheDocument();
    });
  });

  describe('no-results type', () => {
    it('renders no results message with query', () => {
      render(<EmptyState type="no-results" query="test query" />);
      
      expect(screen.getByText('No Results Found')).toBeInTheDocument();
      expect(screen.getByText(/test query/)).toBeInTheDocument();
    });

    it('includes vault name when provided', () => {
      render(<EmptyState type="no-results" query="test query" vaultName="my-vault" />);
      
      expect(screen.getByText(/in vault "my-vault"/)).toBeInTheDocument();
    });

    it('shows search suggestions', () => {
      render(<EmptyState type="no-results" query="test query" />);
      
      expect(screen.getByText('Try:')).toBeInTheDocument();
      expect(screen.getByText(/different or more general keywords/)).toBeInTheDocument();
      expect(screen.getByText(/Using synonyms/)).toBeInTheDocument();
    });
  });

  describe('no-vault type', () => {
    it('renders no vault selected message', () => {
      render(<EmptyState type="no-vault" />);
      
      expect(screen.getByText('No Vault Selected')).toBeInTheDocument();
      expect(screen.getByText(/select a vault to search/)).toBeInTheDocument();
    });

    it('shows configure vault button when handler provided', async () => {
      const user = userEvent.setup();
      render(<EmptyState type="no-vault" onConfigureVault={mockOnConfigureVault} />);
      
      const configureButton = screen.getByRole('button', { name: /configure vault/i });
      expect(configureButton).toBeInTheDocument();
      
      await user.click(configureButton);
      expect(mockOnConfigureVault).toHaveBeenCalled();
    });

    it('does not show configure button when handler not provided', () => {
      render(<EmptyState type="no-vault" />);
      
      const configureButton = screen.queryByRole('button', { name: /configure vault/i });
      expect(configureButton).not.toBeInTheDocument();
    });
  });

  describe('error type', () => {
    it('renders error message', () => {
      render(<EmptyState type="error" />);
      
      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong while searching/)).toBeInTheDocument();
    });

    it('shows retry button when handler provided', async () => {
      const user = userEvent.setup();
      render(<EmptyState type="error" onRetry={mockOnRetry} />);
      
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      
      await user.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalled();
    });

    it('does not show retry button when handler not provided', () => {
      render(<EmptyState type="error" />);
      
      const retryButton = screen.queryByRole('button', { name: /try again/i });
      expect(retryButton).not.toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState type="no-query" className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders appropriate icons for each type', () => {
    const { rerender } = render(<EmptyState type="no-query" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    
    rerender(<EmptyState type="no-results" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    
    rerender(<EmptyState type="no-vault" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    
    rerender(<EmptyState type="error" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});