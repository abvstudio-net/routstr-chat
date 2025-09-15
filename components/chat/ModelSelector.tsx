import { useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, Loader2, Search, Star } from 'lucide-react';
import { Model } from '@/data/models';
import { getModelNameWithoutProvider, getProviderFromModelName } from '@/data/models';

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
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);

  // Filter models based on search query
  const filteredModels = models.filter(model => 
    getModelNameWithoutProvider(model.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Determine which model's details to show in the right pane
  const previewModel: Model | null = useMemo(() => {
    const fromHover = filteredModels.find(m => m.id === hoveredModelId);
    if (fromHover) return fromHover;
    if (selectedModel && filteredModels.some(m => m.id === selectedModel.id)) return selectedModel as Model;
    return filteredModels[0] ?? null;
  }, [filteredModels, hoveredModelId, selectedModel]);

  // Display helpers: convert sats/token -> tokens/sat
  const computeTokensPerSat = (satsPerToken?: number): number | null => {
    if (typeof satsPerToken !== 'number' || !isFinite(satsPerToken) || satsPerToken <= 0) return null;
    return 1 / satsPerToken;
  };

  const formatTokensPerSat = (satsPerToken?: number): string => {
    const value = computeTokensPerSat(satsPerToken);
    if (value === null) return '—';
    if (value >= 1000) return `${Math.round(value).toLocaleString()} token/sat`;
    return `${value.toFixed(2)} token/sat`;
  };

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
      if (!model?.sats_pricing) return true; // If no pricing, assume available
      const estimatedMinCost = getEstimatedMinCost(model);
      if (!estimatedMinCost || estimatedMinCost <= 0) return true;
      return balance >= estimatedMinCost;
    }
    catch(error){ 
      console.log(model);
      console.error(error);
    }
  };

  // Calculate the minimum estimated sats needed to run this model
  const getEstimatedMinCost = (model: Model): number => {
    try {
      if (!model?.sats_pricing) return 0;
      const { prompt, max_cost, max_completion_cost } = model.sats_pricing as any;

      // Fallback to max_cost when max_completion_cost isn't provided
      if (typeof max_completion_cost !== 'number') {
        return typeof max_cost === 'number' ? max_cost : 0;
      }

      const approximateTokens = 2000;
      const promptCosts = typeof prompt === 'number' ? prompt * approximateTokens : 0;
      const totalEstimatedCosts = promptCosts + max_completion_cost;
      return typeof totalEstimatedCosts === 'number' && isFinite(totalEstimatedCosts)
        ? totalEstimatedCosts
        : 0;
    } catch (error) {
      console.error(error);
      return 0;
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

  // Render a model item
  const renderModelItem = (model: Model, isFavorite = false) => {
    const isAvailable = isModelAvailable(model);
    const estimatedMinCost = getEstimatedMinCost(model);
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
        onMouseEnter={() => setHoveredModelId(model.id)}
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
              {formatTokensPerSat(model?.sats_pricing?.completion)}
              {!isAvailable && estimatedMinCost > 0 && (
                <span className="ml-2 text-yellow-400 font-medium">• Min: {estimatedMinCost.toFixed(0)} sats</span>
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
        className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-3 sm:px-4 h-[36px] text-xs sm:text-sm transition-colors cursor-pointer border border-white/10 overflow-hidden max-w-[calc(100vw-260px)] sm:max-w-none"
        data-tutorial="model-selector"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedModel && favoriteModels.includes(selectedModel.id) && (
            <Star className="h-3 w-3 text-yellow-400 fill-current" />
          )}
          <span className="font-medium truncate whitespace-nowrap">{selectedModel ? getModelNameWithoutProvider(selectedModel.name) : 'Select Model'}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-white/70 flex-shrink-0" />
      </button>

      {isModelDrawerOpen && isAuthenticated && (
        <div
          ref={modelDrawerRef}
          className="absolute top-full left-1/2 transform -translate-x-1/2 w-[720px] max-w-[95vw] mt-1 bg-black border border-white/10 rounded-md shadow-lg max-h-[70vh] overflow-hidden z-50"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* Left: Search + List */}
            <div className="border-r border-white/10">
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
                <div className="overflow-y-auto max-h-[60vh]">
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

            {/* Right: Details */}
            <div className="p-3 overflow-y-auto max-h-[70vh]">
              {previewModel ? (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-white/50">{getProviderFromModelName(previewModel.name)}</div>
                      <div className="text-base font-semibold truncate">{getModelNameWithoutProvider(previewModel.name)}</div>
                    </div>
                    {favoriteModels.includes(previewModel.id) && (
                      <Star className="h-4 w-4 text-yellow-400 fill-current flex-shrink-0" />
                    )}
                  </div>

                  {previewModel.description && (
                    <div className="text-xs text-white/60 line-clamp-4">
                      {previewModel.description}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 rounded-md p-2 border border-white/10">
                      <div className="text-white/60">Context length</div>
                      <div className="font-medium">{previewModel.context_length?.toLocaleString?.() ?? '—'} tokens</div>
                    </div>
                    <div className="bg-white/5 rounded-md p-2 border border-white/10">
                      <div className="text-white/60">Modality</div>
                      <div className="font-medium">{previewModel.architecture?.modality ?? '—'}</div>
                    </div>
                    <div className="bg-white/5 rounded-md p-2 border border-white/10">
                      <div className="text-white/60">Tokenizer</div>
                      <div className="font-medium">{previewModel.architecture?.tokenizer ?? '—'}</div>
                    </div>
                    <div className="bg-white/5 rounded-md p-2 border border-white/10">
                      <div className="text-white/60">Instruct type</div>
                      <div className="font-medium">{previewModel.architecture?.instruct_type ?? '—'}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-white/60">Pricing</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 rounded-md p-2 border border-white/10">
                        <div className="text-white/60">Prompt</div>
                        <div className="font-medium">
                          {formatTokensPerSat(previewModel?.sats_pricing?.prompt)}
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-md p-2 border border-white/10">
                        <div className="text-white/60">Completion</div>
                        <div className="font-medium">
                          {formatTokensPerSat(previewModel?.sats_pricing?.completion)}
                        </div>
                      </div>
                    </div>
                    {(previewModel?.sats_pricing?.max_cost || previewModel?.sats_pricing?.max_completion_cost) && (
                      <div className="text-[11px] text-white/50">
                        Est. min: {getEstimatedMinCost(previewModel).toFixed(0)} sats
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-white/60">Capabilities</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(previewModel?.architecture?.input_modalities?.includes('image') || (previewModel?.pricing?.image ?? 0) > 0) && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Images</span>
                      )}
                      {(previewModel?.pricing?.web_search ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Web search</span>
                      )}
                      {(previewModel?.pricing?.internal_reasoning ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Thinking</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">{previewModel.architecture?.output_modalities?.join(', ') || 'Text output'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/50">No model selected</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}