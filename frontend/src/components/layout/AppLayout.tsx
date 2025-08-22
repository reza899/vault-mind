import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Logo from '@/components/ui/Logo';

interface AppLayoutProps {
  children?: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  
  // Define page information for breadcrumbs
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Home', showBack: false };
      case '/search':
        return { title: 'Search Vaults', showBack: true };
      case '/configure':
        return { title: 'Configure Vault', showBack: true };
      case '/vaults':
        return { title: 'Manage Vaults', showBack: true };
      default:
        return { title: 'Vault Mind', showBack: true };
    }
  };

  const pageInfo = getPageInfo();
  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {/* Back Button - only show on non-home pages */}
              {pageInfo.showBack && (
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 
                    hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                    border border-gray-300 dark:border-gray-600"
                  title="Back to Home"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Back</span>
                </Link>
              )}

              {/* Logo and Title */}
              <div className="flex items-center space-x-3">
                <Logo variant="text" size="md" />
                {!isHomePage && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>/</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {pageInfo.title}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
              </div>
              
              {/* Theme Toggle */}
              <button 
                onClick={() => document.documentElement.classList.toggle('dark')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Toggle theme"
              >
                🌓
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children || <Outlet />}
      </main>

      {/* Footer - docked to bottom on all pages */}
      <footer className="mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-3">
            <Logo variant="text" size="sm" />
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Intelligent Obsidian Search
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;