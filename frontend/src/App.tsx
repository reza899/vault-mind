import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useKeyboardShortcut, getCommandKey } from '@/hooks/useKeyboardShortcut';
import { useVaultContext } from '@/hooks/useVaultContext';
import VaultSwitcher from '@/components/vault/VaultSwitcher';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import SearchPage from '@/pages/SearchPage';
import VaultConfigurationPage from '@/pages/VaultConfigurationPage';
import VaultsPage from '@/pages/VaultsPage';

function App() {
  const [isVaultSwitcherOpen, setIsVaultSwitcherOpen] = useState(false);
  
  // Vault context management
  const [vaultContext, vaultActions] = useVaultContext();

  // Global keyboard shortcut for vault switcher (Cmd/Ctrl + K)
  useKeyboardShortcut(`${getCommandKey()}+k`, () => {
    setIsVaultSwitcherOpen(true);
  });

  const handleVaultSelect = (selectedVaultName: string) => {
    vaultActions.switchVault(selectedVaultName);
    // You could navigate to search page or update the current context here
    console.log('Vault selected:', selectedVaultName);
  };


  return (
    <Router>
      <div className="App">
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/configure" element={<VaultConfigurationPage />} />
            <Route path="/vaults" element={<VaultsPage />} />
          </Routes>
        </AppLayout>

        {/* Global Vault Switcher */}
        <VaultSwitcher
          isOpen={isVaultSwitcherOpen}
          onClose={() => setIsVaultSwitcherOpen(false)}
          currentVaultName={vaultContext.currentVault || undefined}
          onVaultSelect={handleVaultSelect}
          onCreateVault={() => {
            setIsVaultSwitcherOpen(false);
          }}
        />
      </div>
    </Router>
  );
}

export default App;