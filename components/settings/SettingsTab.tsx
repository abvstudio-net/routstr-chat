import React, { useState, useEffect } from 'react';
import { LogOut, Plus, XCircle } from 'lucide-react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { Model } from '@/data/models';

interface SettingsTabProps {
  publicKey: string | null;
  logout?: () => void;
  router?: AppRouterInstance;
  onClose: () => void;
  tempMintUrl: string;
  setTempMintUrl: (url: string) => void;
  tempBaseUrl: string;
  setTempBaseUrl: (url: string) => void;
  selectedModel: Model | null;
  handleModelChange: (modelId: string) => void;
  models: readonly Model[];
  clearConversations: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  publicKey,
  logout,
  router,
  onClose,
  tempMintUrl,
  setTempMintUrl,
  tempBaseUrl,
  setTempBaseUrl,
  selectedModel,
  handleModelChange,
  models,
  clearConversations,
}) => {
  const [baseUrls, setBaseUrls] = useState<string[]>([]);
  const [newBaseUrlInput, setNewBaseUrlInput] = useState<string>('');

  useEffect(() => {
    const storedBaseUrls = localStorage.getItem('base_urls_list');
    let initialBaseUrls: string[] = [];

    if (storedBaseUrls) {
      initialBaseUrls = JSON.parse(storedBaseUrls);
    }

    // Ensure tempBaseUrl is always in the list if it's a valid URL
    if (tempBaseUrl && !initialBaseUrls.includes(tempBaseUrl)) {
      initialBaseUrls = [tempBaseUrl, ...initialBaseUrls];
    }

    // If no URLs are stored and tempBaseUrl is also empty, add a default
    if (initialBaseUrls.length === 0) {
      initialBaseUrls = ['https://api.routstr.com/'];
    }

    setBaseUrls(initialBaseUrls);
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    if (baseUrls.length !== 0) {
      localStorage.setItem('base_urls_list', JSON.stringify(baseUrls));
    }
  }, [baseUrls]);

  const handleAddBaseUrl = () => {
    if (newBaseUrlInput.trim() && !baseUrls.includes(newBaseUrlInput.trim())) {
      setBaseUrls([...baseUrls, newBaseUrlInput.trim()]);
      setNewBaseUrlInput('');
    }
  };

  const handleRemoveBaseUrl = (urlToRemove: string) => {
    const updatedUrls = baseUrls.filter(url => url !== urlToRemove);
    setBaseUrls(updatedUrls);
    // If the removed URL was the currently selected one, select the first available URL or clear it
    if (tempBaseUrl === urlToRemove) {
      setTempBaseUrl(updatedUrls.length > 0 ? updatedUrls[0] : '');
    }
  };

  const handleRadioChange = (url: string) => {
    setTempBaseUrl(url);
  };

  return (
    <>
      {/* Account Section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Account</h3>
        <div className="mb-3 bg-white/5 border border-white/10 rounded-md p-3">
          <div className="text-xs text-white/50 mb-1">Nostr Public Key</div>
          <div className="font-mono text-xs text-white/70 break-all">
            {publicKey || 'Not available'}
          </div>
        </div>
        {logout && router && (
          <button
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out?')) {
                logout();
                router.push('/');
                onClose();
              }
            }}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {/* Mint URL */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Cashu Mint URL</h3>
        <input
          type="text"
          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          placeholder="https://mint.minibits.cash/Bitcoin"
          value={tempMintUrl}
          onChange={(e) => setTempMintUrl(e.target.value)}
        />
        <p className="text-xs text-white/50 mt-1">The Cashu mint used for token generation</p>
      </div>

      {/* Base URL */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Base URL</h3>
        <div className="bg-white/5 border border-white/10 rounded-md p-4">
          <p className="text-sm text-white mb-3">Choose your preferred Routstr API base URL</p>
          <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
            {baseUrls.map((url, index) => (
              <div className="flex items-center justify-between" key={index}>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id={`baseUrl-${index}`}
                    name="baseUrl"
                    className="mr-2"
                    checked={tempBaseUrl === url}
                    onChange={() => handleRadioChange(url)}
                  />
                  <label htmlFor={`baseUrl-${index}`} className="text-sm text-white">{url}</label>
                </div>
                <button
                  onClick={() => handleRemoveBaseUrl(url)}
                  className="text-red-400 hover:text-red-500 transition-colors"
                  type="button"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-grow bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              placeholder="Add new base URL"
              value={newBaseUrlInput}
              onChange={(e) => setNewBaseUrlInput(e.target.value)}
            />
            <button
              onClick={handleAddBaseUrl}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1"
              type="button"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Default Model</h3>
        <div className="bg-white/5 border border-white/10 rounded-md p-4">
          <p className="text-sm text-white mb-3">Choose your preferred default AI model</p>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {models.map((model) => (
              <div className="flex items-center" key={model.id}>
                <input
                  type="radio"
                  id={model.id}
                  name="model"
                  className="mr-2"
                  checked={selectedModel?.id === model.id}
                  onChange={() => handleModelChange(model.id)}
                />
                <label htmlFor={model.id} className="text-sm text-white">{model.name}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 pt-4 border-t border-white/10">
        <h3 className="text-sm font-medium text-red-400 mb-4">Danger Zone</h3>
        <div className="space-y-3">
          <button
            className="w-full bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-2 rounded-md text-sm hover:bg-red-500/20 transition-colors cursor-pointer"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
                clearConversations();
                onClose();
              }
            }}
            type="button"
          >
            Clear conversation history
          </button>
        </div>
      </div>
    </>
  );
};

export default SettingsTab;