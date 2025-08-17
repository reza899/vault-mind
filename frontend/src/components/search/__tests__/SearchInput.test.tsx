import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SearchInput from '../SearchInput';

const mockOnQueryChange = vi.fn();
const mockOnSearch = vi.fn();

const defaultProps = {
  query: '',
  onQueryChange: mockOnQueryChange,
  onSearch: mockOnSearch,
};

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Search your vault...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('displays custom placeholder', () => {
    render(<SearchInput {...defaultProps} placeholder="Custom placeholder" />);
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('handles input changes with debouncing', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} debounceMs={100} />);
    
    const input = screen.getByPlaceholderText('Search your vault...');
    
    await user.type(input, 'test query');
    
    // Should not call onQueryChange immediately
    expect(mockOnQueryChange).not.toHaveBeenCalled();
    
    // Should call after debounce delay
    await waitFor(() => {
      expect(mockOnQueryChange).toHaveBeenCalledWith('test query');
    }, { timeout: 200 });
  });

  it('triggers search on Enter key', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Search your vault...');
    
    await user.type(input, 'test query{enter}');
    
    expect(mockOnSearch).toHaveBeenCalled();
  });

  it('clears input on Escape key', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} query="initial query" />);
    
    const input = screen.getByDisplayValue('initial query');
    
    await user.click(input);
    await user.keyboard('{Escape}');
    
    expect(mockOnQueryChange).toHaveBeenCalledWith('');
  });

  it('shows clear button when query is not empty', () => {
    render(<SearchInput {...defaultProps} query="test query" />);
    
    const clearButton = screen.getByLabelText('Clear search');
    expect(clearButton).toBeInTheDocument();
  });

  it('hides clear button when query is empty', () => {
    render(<SearchInput {...defaultProps} query="" />);
    
    const clearButton = screen.queryByLabelText('Clear search');
    expect(clearButton).not.toBeInTheDocument();
  });

  it('clears query when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} query="test query" />);
    
    const clearButton = screen.getByLabelText('Clear search');
    await user.click(clearButton);
    
    expect(mockOnQueryChange).toHaveBeenCalledWith('');
  });

  it('triggers search when search button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchInput {...defaultProps} query="test query" />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    await user.click(searchButton);
    
    expect(mockOnSearch).toHaveBeenCalled();
  });

  it('disables search button when query is empty', () => {
    render(<SearchInput {...defaultProps} query="" />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).toBeDisabled();
  });

  it('disables search button when loading', () => {
    render(<SearchInput {...defaultProps} query="test" loading={true} />);
    
    const searchButton = screen.getByRole('button');
    expect(searchButton).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    render(<SearchInput {...defaultProps} loading={true} />);
    
    const spinner = screen.getByRole('button').querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('syncs with external query changes', () => {
    const { rerender } = render(<SearchInput {...defaultProps} query="initial" />);
    
    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();
    
    rerender(<SearchInput {...defaultProps} query="updated" />);
    
    expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
  });

  it('does not auto-focus when autoFocus is false', () => {
    render(<SearchInput {...defaultProps} autoFocus={false} />);
    
    const input = screen.getByPlaceholderText('Search your vault...');
    expect(input).not.toHaveFocus();
  });

  it('applies custom className', () => {
    render(<SearchInput {...defaultProps} className="custom-class" />);
    
    const container = screen.getByPlaceholderText('Search your vault...').closest('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('shows search hint text', () => {
    render(<SearchInput {...defaultProps} />);
    
    expect(screen.getByText('Press Enter to search, Escape to clear')).toBeInTheDocument();
  });
});