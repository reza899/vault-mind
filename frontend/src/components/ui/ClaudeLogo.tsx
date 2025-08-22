import React from 'react';

interface ClaudeLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ClaudeLogo: React.FC<ClaudeLogoProps> = ({ className = '', size = 'md' }) => {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'md': return 'text-sm';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  return (
    <span className={`font-medium ${getSizeClass()} ${className}`}>
      Claude Code
    </span>
  );
};

export default ClaudeLogo;