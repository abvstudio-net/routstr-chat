import React, { useState, useEffect } from 'react';
import { LogOut, Plus, XCircle, ChevronDown, ChevronUp, Search, Star, Eye, Copy } from 'lucide-react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { Model } from '@/data/models';
import { loadBaseUrlsList, saveBaseUrlsList } from '@/utils/storageUtils';
import NostrRelayManager from './NostrRelayManager'; // Import the new component

interface GeneralTabProps {
  publicKey: string | undefined;
  nsecData?: { nsec: `nsec1${string}`; } | { bunkerPubkey: string; clientNsec: `nsec1${string}`; relays: string[]; } | { [key: string]: unknown; } | null;
  loginType: 'nsec' | "bunker" | "extension" | `x-${string}` | undefined;
  logout?: () => void;
  router?: AppRouterInstance;
  onClose: () => void;
  mintUrl: string;
  setMintUrl: (url: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  selectedModel: Model | null;
  handleModelChange: (modelId: string) => void;
  models: readonly Model[];
  favoriteModels: string[];
  toggleFavoriteModel: (modelId: string) => void;
}

const GeneralTab: React.FC<GeneralTabProps> = ({
  publicKey,
  nsecData,
  loginType,
  logout,
  router,
  onClose,
  mintUrl,
  setMintUrl,
  baseUrl,
  setBaseUrl,
  selectedModel,
  handleModelChange,
  models,
  favoriteModels,
  toggleFavoriteModel,
}) => {
  const [baseUrls, setBaseUrls] = useState<string[]>([]);
  const [newBaseUrlInput, setNewBaseUrlInput] = useState<string>('');
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState<boolean>(false);
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');
  const [isFavoritesManagerOpen, setIsFavoritesManagerOpen] = useState<boolean>(false);
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState<string>('');
  const [showNsec, setShowNsec] = useState<boolean>(false);
  const [nsecValue, setNsecValue] = useState<string>('');
  const [showNsecWarning, setShowNsecWarning] = useState<boolean>(false);

  const toast = (message: string) => {
    alert(message); // Placeholder for a proper toast notification
  };

  useEffect(() => {
    setBaseUrls(loadBaseUrlsList());
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    if (localStorage.getItem('nsec_storing_skipped') === 'true') {
      setShowNsecWarning(true);
    }
  }, []);

  const handleCloseNsecWarning = () => {
    if (window.confirm('Are you sure you want to dismiss this warning? You will not be reminded again unless you clear your browser local storage.')) {
      localStorage.setItem('nsec_storing_skipped', 'false');
      setShowNsecWarning(false);
    }
  };

  const handleAddBaseUrl = () => {
    const trimmedUrl = newBaseUrlInput.trim();
    if (trimmedUrl && !baseUrls.includes(trimmedUrl)) {
      const formattedNewBaseUrl = trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`;
      const updatedBaseUrls = [...baseUrls, formattedNewBaseUrl];
      setBaseUrls(updatedBaseUrls);
      saveBaseUrlsList(updatedBaseUrls); // Save to storage
      setNewBaseUrlInput('');
      setBaseUrl(formattedNewBaseUrl);
    }
  };

  const handleRemoveBaseUrl = (urlToRemove: string) => {
    const updatedUrls = baseUrls.filter(url => url !== urlToRemove);
    setBaseUrls(updatedUrls);
    saveBaseUrlsList(updatedUrls); // Save to storage
    // If the removed URL was the currently selected one, select the first available URL or clear it
    if (normalizeUrl(baseUrl) === normalizeUrl(urlToRemove)) {
      const newBaseUrl = updatedUrls.length > 0 ? normalizeUrl(updatedUrls[0]) : '';
      setBaseUrl(newBaseUrl);
    }
  };

  const normalizeUrl = (url: string) => url.endsWith('/') ? url : `${url}/`;

  const handleRadioChange = (url: string) => {
    const normalizedUrl = normalizeUrl(url);
    setBaseUrl(normalizedUrl);
  };

  // Filter models based on search query
  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  // Filter models for favorites management
  const filteredModelsForFavorites = models.filter(model =>
    model.name.toLowerCase().includes(favoritesSearchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(favoritesSearchQuery.toLowerCase())
  );

  // Sort models with favorites first, then alphabetically (for default selection)
  const sortedModels = [...filteredModels].sort((a, b) => {
    const aIsFavorite = favoriteModels.includes(a.id);
    const bIsFavorite = favoriteModels.includes(b.id);

    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;

    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {showNsecWarning && (
        <div className="relative bg-red-500/5 border border-red-500/20 text-red-400 px-4 py-3 rounded-md mb-6">
          <p className="text-sm">
            <span className="font-bold">Warning:</span> Your nsec is currently stored only in your browser's local storage. It will be lost if you clear your browser data. Please consider exporting and securely storing your nsec.
          </p>
          <button
            onClick={handleCloseNsecWarning}
            className="absolute top-2 right-2 text-red-400 hover:text-red-500 transition-colors"
            type="button"
            title="Dismiss warning"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Cashu Mint URL</h3>
        <input
          type="text"
          className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          placeholder="https://mint.minibits.cash/Bitcoin"
          value={mintUrl}
          onChange={(e) => setMintUrl(e.target.value)}
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
                    className="mr-2 accent-gray-500"
                    checked={normalizeUrl(baseUrl) === normalizeUrl(url)}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddBaseUrl();
                }
              }}
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

      {/* Nostr Relays */}
      <NostrRelayManager />

      {/* Model Preferences */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-4">Model Preferences</h3>

        {/* Default Model Selection */}
        <div className="bg-white/5 border border-white/10 rounded-md p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Default Model</h4>
              <p className="text-sm text-white">Currently selected: {selectedModel?.name || 'None'}</p>
              <p className="text-xs text-white/50">Choose your preferred default AI model</p>
            </div>
            <button
              onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1"
              type="button"
            >
              {isModelSelectorOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Change Default
                </>
              )}
            </button>
          </div>

          {isModelSelectorOpen && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                  placeholder="Search models..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                />
              </div>

              {/* Model Dropdown List - Clean, no favoriting controls */}
              <div className="bg-white/5 border border-white/10 rounded-md max-h-48 overflow-y-auto">
                {sortedModels.length > 0 ? (
                  sortedModels.map((model) => {
                    const isFavorite = favoriteModels.includes(model.id);
                    return (
                      <button
                        key={model.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 ${selectedModel?.id === model.id ? 'bg-white/10 text-white' : 'text-white/80'
                          }`}
                        onClick={() => {
                          handleModelChange(model.id);
                          setIsModelSelectorOpen(false);
                          setModelSearchQuery('');
                        }}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          {isFavorite && <Star className="h-3 w-3 text-yellow-400 fill-current" />}
                          <span>{model.name}</span>
                          {selectedModel?.id === model.id && (
                            <span className="text-xs text-green-400 ml-auto">✓ Selected</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-white/50 text-center py-4">
                    No models found matching "{modelSearchQuery}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Favorite Models Management */}
        <div className="bg-white/5 border border-white/10 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Favorite Models</h4>
              <p className="text-xs text-white/50">
                Quick access to your preferred models
              </p>
            </div>
            <button
              onClick={() => setIsFavoritesManagerOpen(!isFavoritesManagerOpen)}
              className="text-white/70 hover:text-white px-2 py-1 rounded text-xs border border-white/20 transition-colors flex items-center gap-1"
              type="button"
            >
              {isFavoritesManagerOpen ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Hide
                </>
              ) : (
                <>
                  <Star className="h-3 w-3" /> Manage
                </>
              )}
            </button>
          </div>

          {/* Current Favorites Overview */}
          {favoriteModels.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {favoriteModels.slice(0, 3).map((modelId) => {
                const model = models.find(m => m.id === modelId);
                if (!model) return null;

                return (
                  <div
                    key={modelId}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-white">{model.name}</span>
                      {selectedModel?.id === modelId && (
                        <span className="text-xs text-green-400 ml-1">• Default</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleFavoriteModel(modelId)}
                      className="text-white/40 hover:text-red-400 transition-colors"
                      type="button"
                      title="Remove from favorites"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {favoriteModels.length > 3 && (
                <p className="text-xs text-white/40 text-center mt-1">
                  +{favoriteModels.length - 3} more favorites
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-3 mb-2">
              <Star className="h-6 w-6 text-white/20 mx-auto mb-1.5" />
              <p className="text-xs text-white/50">No favorite models yet</p>
              <p className="text-xs text-white/30 text-[10px]">Use "Manage" to add favorites</p>
            </div>
          )}

          {/* Favorites Management Interface */}
          {isFavoritesManagerOpen && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-white/50" />
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  placeholder="Search models to favorite..."
                  value={favoritesSearchQuery}
                  onChange={(e) => setFavoritesSearchQuery(e.target.value)}
                />
              </div>

              {/* All Models List for Favoriting */}
              <div className="bg-white/5 border border-white/10 rounded-md max-h-40 overflow-y-auto">
                {filteredModelsForFavorites.length > 0 ? (
                  filteredModelsForFavorites.map((model) => {
                    const isFavorite = favoriteModels.includes(model.id);
                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-1.5">
                          {selectedModel?.id === model.id && (
                            <span className="text-xs text-green-400 mr-1">•</span>
                          )}
                          <span className="text-white/80">{model.name}</span>
                        </div>
                        <button
                          onClick={() => toggleFavoriteModel(model.id)}
                          className={`p-1 rounded-sm transition-colors ${isFavorite
                              ? 'text-yellow-400 hover:text-yellow-300'
                              : 'text-white/30 hover:text-yellow-400'
                            }`}
                          type="button"
                          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-white/50 text-center py-3">
                    No models found matching "{favoritesSearchQuery}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">Account</h3>
        <div className="mb-3 bg-white/5 border border-white/10 rounded-md p-3">
          <div className="text-xs text-white/50 mb-1">Nostr Public Key</div>
          <div className="font-mono text-xs text-white/70 break-all">
            {publicKey || 'Not available'}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {loginType === 'nsec' && nsecData && (
            <button
              className="flex-grow flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
              onClick={() => {
                const nsec = nsecData && 'nsec' in nsecData && typeof nsecData.nsec === 'string' && nsecData.nsec.startsWith('nsec1') ? nsecData.nsec : '';
                setNsecValue(nsec);
                setShowNsec(!showNsec);
              }}
              type="button"
            >
              <span>{showNsec ? 'Hide nsec' : 'Export nsec'}</span>
            </button>
          )}
          {logout && router && (
            <button
              className="flex-grow flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
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
        {showNsec && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-md text-sm text-white break-all mt-2">
            <span className="flex-grow">{nsecValue}</span>
            <button
              className="p-1 rounded-md hover:bg-white/10"
              onClick={() => {
                navigator.clipboard.writeText(nsecValue);
                toast('nsec copied to clipboard!');
              }}
              type="button"
              title="Copy nsec"
            >
              <Copy className="h-4 w-4 text-white/70" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default GeneralTab;