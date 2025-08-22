import React from 'react';
import VaultDashboard from '@/components/vault/VaultDashboard';
import { useNavigate } from 'react-router-dom';

const VaultsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VaultDashboard 
          onCreateVault={() => navigate('/configure')}
          onViewVaultDetails={(collectionName) => {
            console.log('View vault details:', collectionName);
            // TODO: Navigate to vault details page when implemented
          }}
        />
        
        {/* Claude Code Integration Tip */}
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm">💡</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Pro Tip: Use ChromaDB MCP in Claude Code
                </h4>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Access your indexed vaults directly in Claude Code using the{' '}
                  <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-xs">
                    /vault-mind
                  </code>
                  {' '}slash command
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultsPage;