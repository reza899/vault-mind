import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  ArchiveBoxIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';
import Logo from '@/components/ui/Logo';
import ObsidianLogo from '@/components/ui/ObsidianLogo';

const HomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to <span className="text-purple-600 dark:text-purple-400">Vault</span><span className="text-gray-900 dark:text-white">Mind</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Transform your Obsidian vault into an intelligent knowledge base
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Connect Your Vault - First Step */}
        <Link 
          to="/configure"
          className="group bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 
            hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 
            transform hover:-translate-y-1"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
              <DocumentTextIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Connect Your Vault
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Transform your Obsidian notes into a searchable knowledge graph with AI-powered indexing.
            </p>
            <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
              Get Started →
            </span>
          </div>
        </Link>

        {/* Explore Your Knowledge - Second Step */}
        <Link 
          to="/search"
          className="group bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 
            hover:border-green-300 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200 
            transform hover:-translate-y-1"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
              <MagnifyingGlassIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Explore Your Knowledge
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Find connections and insights across your notes with intelligent semantic search.
            </p>
            <span className="text-green-600 dark:text-green-400 font-medium group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
              Start Searching →
            </span>
          </div>
        </Link>

        {/* Your Collections - Third Step */}
        <Link 
          to="/vaults"
          className="group bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 
            hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 
            transform hover:-translate-y-1"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30 transition-colors">
              <ArchiveBoxIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Your Collections
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Monitor indexing progress and manage your connected knowledge bases.
            </p>
            <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
              View Vaults →
            </span>
          </div>
        </Link>
      </div>


      {/* Claude Code Integration - Minimal */}
      <div className="mt-16 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          💡 Use the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">/vault-mind</code> slash command to query your indexed vaults
        </p>
      </div>
    </div>
  );
};

export default HomePage;