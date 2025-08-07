import { useRef, useEffect, useState } from 'react';
import { ChevronDown, Loader2, Search, Star } from 'lucide-react';
import { Model } from '@/types/chat';
import { getModelNameWithoutProvider } from '@/data/models';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ModelSelectorProps {
  selectedModel: Model | null;
  isModelDrawerOpen: boolean;
  setIsModelDrawerOpen: (isOpen: boolean) => void;
  isAuthenticated: boolean;
  setIsLoginModalOpen: (isOpen: boolean) => void;
  isLoadingModels: boolean;
  filteredModels: Model[];
  handleModelChange: (modelId: string) => void;
  balance: number;
  favoriteModels: string[];
  toggleFavoriteModel: (modelId: string) => void;
}

export default function ModelSelector({
  selectedModel,
  isModelDrawerOpen,
  setIsModelDrawerOpen,
  isAuthenticated,
  setIsLoginModalOpen,
  isLoadingModels,
  filteredModels: models,
  handleModelChange,
  balance,
  favoriteModels,
  toggleFavoriteModel,
}: ModelSelectorProps) {
  const modelDrawerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Filter models based on search query
  const filteredModels = models.filter(model => 
    getModelNameWithoutProvider(model.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate favorite and non-favorite models
  const favoriteModelsList = filteredModels.filter(model => 
    favoriteModels.includes(model.id)
  );
  
  const regularModelsList = filteredModels.filter(model => 
    !favoriteModels.includes(model.id)
  );

  // Check if a model is available based on balance
  const isModelAvailable = (model: Model) => {
    try {
      return balance >= model.sats_pricing.max_cost;
    }
    catch(error){ 
      console.log(model);
      console.error(error);
    }
  };

  // Focus search input when drawer opens
  useEffect(() => {
    if (isModelDrawerOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
    }
  }, [isModelDrawerOpen]);

  // Close model drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isModelDrawerOpen && modelDrawerRef.current &&
        !modelDrawerRef.current.contains(event.target as Node)) {
        setIsModelDrawerOpen(false);
      }
    };

    if (isModelDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDrawerOpen, setIsModelDrawerOpen]);

  // Handle search input keydown events
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent propagation to avoid closing the drawer
    e.stopPropagation();
    
    // Handle escape key to clear search
    if (e.key === 'Escape') {
      setSearchQuery('');
      e.preventDefault();
    }
  };

  // Truncate model name for mobile display
  const truncateModelName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  // Render a model item
  const renderModelItem = (model: Model, isFavorite = false) => {
    const isAvailable = isModelAvailable(model);
    return (
      <div
        key={model.id}
        className={`p-2 text-sm rounded-md transition-colors ${
          !isAvailable 
            ? 'opacity-40 cursor-not-allowed' 
            : selectedModel?.id === model.id
            ? isFavorite 
              ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30' 
              : 'bg-white/10 cursor-pointer'
            : 'hover:bg-white/5 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Star Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteModel(model.id);
            }}
            className={`flex-shrink-0 p-0.5 rounded transition-colors cursor-pointer ${
              isFavorite 
                ? 'text-yellow-400 hover:text-yellow-300' 
                : 'text-white/30 hover:text-yellow-400'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            type="button"
          >
            <Star className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Model Info - Clickable area for selection */}
          <div 
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              if (isAvailable) {
                handleModelChange(model.id);
                setIsModelDrawerOpen(false);
              }
            }}
          >
            <div className={`font-medium truncate ${isFavorite ? 'text-yellow-100' : ''}`}>
              {getModelNameWithoutProvider(model.name)}
            </div>
            <div className="text-xs text-white/50">
              {model.sats_pricing.completion.toFixed(4)} sats
              {!isAvailable && model.sats_pricing.max_cost > 0 && (
                <span className="ml-2 text-yellow-400 font-medium">• Min: {model.sats_pricing.max_cost.toFixed(0)} sats</span>
              )}
            </div>
          </div>
          
          {/* Selected Indicator */}
          {selectedModel?.id === model.id && (
            <div className={`text-xs font-medium flex-shrink-0 ${isFavorite ? 'text-yellow-300' : 'text-green-400'}`}>
              ✓
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => isAuthenticated ? setIsModelDrawerOpen(!isModelDrawerOpen) : setIsLoginModalOpen(true)}
        className={`flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-4 h-[36px] text-sm transition-colors cursor-pointer border border-white/10 ${
          isMobile ? 'max-w-[180px]' : ''
        }`}
        data-tutorial="model-selector"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {selectedModel && favoriteModels.includes(selectedModel.id) && (
            <Star className="h-3 w-3 text-yellow-400 fill-current flex-shrink-0" />
          )}
          <span className="font-medium truncate" title={selectedModel ? getModelNameWithoutProvider(selectedModel.name) : 'Select Model'}>
            {selectedModel 
              ? isMobile 
                ? truncateModelName(getModelNameWithoutProvider(selectedModel.name), 15)
                : getModelNameWithoutProvider(selectedModel.name)
              : 'Select Model'
            }
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-white/70 flex-shrink-0" />
      </button>

      {isModelDrawerOpen && isAuthenticated && (
        <div
          ref={modelDrawerRef}
          className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-black border border-white/10 rounded-md shadow-lg max-h-80 overflow-hidden z-50 ${
            isMobile ? 'w-80 max-w-[90vw]' : 'w-72'
          }`}
        >
          {/* Search bar */}
          <div className="sticky top-0 p-2 bg-black/90 backdrop-blur-sm border-b border-white/10">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-white/40" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1 pl-8 pr-2 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-white/40 hover:text-white/60"
                >
                  <span className="text-xs">×</span>
                </button>
              )}
            </div>
          </div>

          {isLoadingModels ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
            </div>
          ) : (
            <div className="overflow-y-auto max-h-64">
              {/* Favorite Models Section */}
              {favoriteModelsList.length > 0 && (
                <div className="p-1">
                  <div className="px-2 py-1 text-xs font-medium text-yellow-400 flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-current" />
                    Favorites
                  </div>
                  <div className="space-y-1">
                    {favoriteModelsList.map((model) => renderModelItem(model, true))}
                  </div>
                </div>
              )}

              {/* Separator */}
              {favoriteModelsList.length > 0 && regularModelsList.length > 0 && (
                <div className="border-t border-white/10 my-1" />
              )}

              {/* Regular Models Section */}
              {regularModelsList.length > 0 && (
                <div className="p-1">
                  {favoriteModelsList.length > 0 && (
                    <div className="px-2 py-1 text-xs font-medium text-white/60">
                      All Models
                    </div>
                  )}
                  <div className="space-y-1">
                    {regularModelsList.map((model) => renderModelItem(model, false))}
                  </div>
                </div>
              )}

              {/* No results */}
              {filteredModels.length === 0 && (
                <div className="p-2 text-sm text-white/50 text-center">No models found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}