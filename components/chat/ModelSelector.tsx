import { useRef, useEffect, useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Search, Settings, Star, Info, Image as ImageIcon, Type } from 'lucide-react';
import type { ReactNode } from 'react';
import { Model } from '@/data/models';
import { getModelNameWithoutProvider, getProviderFromModelName } from '@/data/models';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { loadModelProviderMap } from '@/utils/storageUtils';

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
  configuredModels: string[];
  openModelsConfig?: () => void;
  toggleConfiguredModel: (modelId: string) => void;
  setModelProviderFor?: (modelId: string, baseUrl: string) => void;
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
  configuredModels,
  openModelsConfig,
  toggleConfiguredModel,
  setModelProviderFor,
}: ModelSelectorProps) {
  const modelDrawerRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeView, setActiveView] = useState<'list' | 'details'>('list');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [detailsModel, setDetailsModel] = useState<Model | null>(null);
  const [modelProviderMap, setModelProviderMap] = useState<Record<string, string>>({});
  const [providerModelCache, setProviderModelCache] = useState<Record<string, Record<string, Model>>>({});
  const [loadingProviderBases, setLoadingProviderBases] = useState<Set<string>>(new Set());
  const [detailsBaseUrl, setDetailsBaseUrl] = useState<string | null>(null);
  const [outputFilters, setOutputFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setModelProviderMap(loadModelProviderMap());
    } catch {
      setModelProviderMap({});
    }
  }, []);

  // Normalize base URL to ensure trailing slash and protocol
  const normalizeBaseUrl = (base?: string | null): string | null => {
    if (!base || typeof base !== 'string' || base.length === 0) return null;
    const withProto = base.startsWith('http') ? base : `https://${base}`;
    return withProto.endsWith('/') ? withProto : `${withProto}/`;
  };

  // Fetch and cache models for a specific provider base URL
  const fetchAndCacheProviderModels = async (baseRaw: string): Promise<void> => {
    const base = normalizeBaseUrl(baseRaw);
    if (!base) return;
    // Avoid duplicate fetches
    if (loadingProviderBases.has(base)) return;
    setLoadingProviderBases(prev => new Set(prev).add(base));
    try {
      const res = await fetch(`${base}v1/models`);
      if (!res.ok) throw new Error(`Failed to fetch models for ${base}: ${res.status}`);
      const json = await res.json();
      const list: readonly Model[] = Array.isArray(json?.data) ? json.data : [];
      const map: Record<string, Model> = {};
      for (const m of list) {
        map[m.id] = m;
      }
      setProviderModelCache(prev => ({ ...prev, [base]: map }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProviderBases(prev => {
        const next = new Set(prev);
        next.delete(base);
        return next;
      });
    }
  };

  // Helpers to parse provider-qualified keys
  const parseModelKey = (key: string): { id: string; base: string | null } => {
    const sep = key.indexOf('@@');
    if (sep === -1) return { id: key, base: null };
    return { id: key.slice(0, sep), base: key.slice(sep + 2) };
  };

  // Current model helpers for top-of-list section
  const currentConfiguredKeyMemo: string | undefined = useMemo(() => {
    if (!selectedModel) return undefined;
    const preferred = configuredModels.find(k => k.startsWith(`${selectedModel.id}@@`));
    if (preferred) return preferred;
    const anyKey = configuredModels.find(k => k === selectedModel.id);
    return anyKey;
  }, [configuredModels, selectedModel]);

  // Determine which provider bases we likely need and prefetch them
  const neededProviderBases: readonly string[] = useMemo(() => {
    const bases = new Set<string>();
    try {
      // From configured favorites (keys may include @@base)
      for (const key of configuredModels) {
        const { base } = parseModelKey(key);
        const norm = normalizeBaseUrl(base);
        if (norm) bases.add(norm);
      }
      // From best-priced mapping for models in view
      for (const m of models) {
        const mapped = normalizeBaseUrl(modelProviderMap[m.id]);
        if (mapped) bases.add(mapped);
      }
      // From current selection key
      if (currentConfiguredKeyMemo) {
        const { base } = parseModelKey(currentConfiguredKeyMemo);
        const norm = normalizeBaseUrl(base);
        if (norm) bases.add(norm);
      }
      // From details panel selection
      if (detailsBaseUrl) {
        const norm = normalizeBaseUrl(detailsBaseUrl);
        if (norm) bases.add(norm);
      }
    } catch {}
    return Array.from(bases);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredModels, models, modelProviderMap, currentConfiguredKeyMemo, detailsBaseUrl]);

  useEffect(() => {
    // Prefetch any needed bases not yet cached
    for (const base of neededProviderBases) {
      if (!providerModelCache[base]) {
        void fetchAndCacheProviderModels(base);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededProviderBases]);

  // Deduplicate models across providers by picking the best-priced variant per id
  const dedupedModels = useMemo(() => {
    const bestById = new Map<string, Model>();
    for (const m of models) {
      const existing = bestById.get(m.id);
      if (!existing) {
        bestById.set(m.id, m);
        continue;
      }
      const currentCost = getEstimatedMinCost(m);
      const existingCost = getEstimatedMinCost(existing);
      if (currentCost < existingCost) {
        bestById.set(m.id, m);
      }
    }
    return Array.from(bestById.values());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // Filter models based on search query and quick output filters
  const filteredModels = dedupedModels.filter(model => {
    const matchesSearch = getModelNameWithoutProvider(model.name)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (outputFilters.size === 0) return true;
    const outputs = (model.architecture?.output_modalities ?? ['text']).map(m => String(m).toLowerCase());
    for (const f of outputFilters) {
      if (outputs.includes(f)) return true;
    }
    return false;
  });

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

  const formatProviderLabel = (baseUrl: string | null | undefined, model: Model): string => {
    try {
      if (baseUrl) {
        const url = new URL(baseUrl);
        return url.host;
      }
    } catch {}
    return getProviderFromModelName(model.name);
  };

  // Treat a model as configured if any configured key matches its id or `${id}@@...`
  const isConfiguredModel = (modelId: string) => {
    return configuredModels.some(key => key === modelId || key.startsWith(`${modelId}@@`));
  };

  // Split into configured and all (remaining) models
  const configuredModelsList = filteredModels.filter(model => isConfiguredModel(model.id));
  const remainingModelsList = filteredModels.filter(model => !isConfiguredModel(model.id));

  // Build favorites entries with provider labels from configured keys
  const favoriteEntries = useMemo(() => {
    return configuredModels
      .map((key) => {
        const { id, base } = parseModelKey(key);
        const model = filteredModels.find(m => m.id === id);
        if (!model) return null;
        const mappedBase = base || modelProviderMap[key] || modelProviderMap[id];
        const providerLabel = formatProviderLabel(mappedBase, model);
        return { key, model, providerLabel } as { key: string; model: Model; providerLabel: string };
      })
      .filter((e): e is { key: string; model: Model; providerLabel: string } => !!e);
  }, [configuredModels, filteredModels, modelProviderMap]);

  // Current model helpers for top-of-list section (alias to memoized key)
  const currentConfiguredKey: string | undefined = currentConfiguredKeyMemo;

  const currentProviderLabel: string | undefined = useMemo(() => {
    if (!selectedModel) return undefined;
    let base: string | null = null;
    if (currentConfiguredKey) {
      const parsed = parseModelKey(currentConfiguredKey);
      base = parsed.base;
    }
    const mappedBase = base || modelProviderMap[currentConfiguredKey || ''] || modelProviderMap[selectedModel.id];
    return formatProviderLabel(mappedBase, selectedModel);
  }, [selectedModel, currentConfiguredKey, modelProviderMap]);

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

  // Reset mobile view state when opening/closing
  useEffect(() => {
    if (isModelDrawerOpen) {
      setActiveView('list');
      setDetailsModel(null);
      setIsTransitioning(false);
    }
  }, [isModelDrawerOpen]);

  // Page-like transition for mobile
  const navigateToView = (view: 'list' | 'details') => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveView(view);
      setIsTransitioning(false);
    }, 150);
  };

  // Close model drawer when clicking outside (ignore clicks on the toggle button)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isModelDrawerOpen) return;
      const target = event.target as Node;
      const clickedInsideDrawer = modelDrawerRef.current?.contains(target);
      const clickedToggle = toggleButtonRef.current?.contains(target);
      if (!clickedInsideDrawer && !clickedToggle) setIsModelDrawerOpen(false);
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

  // Quick filter badges for output modalities
  const quickOutputOptions: { key: string; label: string; icon: ReactNode }[] = [
    { key: 'text', label: 'Text', icon: <Type className="h-3.5 w-3.5" /> },
    { key: 'image', label: 'Image', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];

  const toggleOutputFilter = (key: string) => {
    setOutputFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderQuickFilters = () => (
    <div className="mt-2 flex gap-1.5 flex-nowrap">
      {quickOutputOptions.map(opt => {
        const isActive = outputFilters.has(opt.key);
        return (
          <button
            key={opt.key}
            onClick={() => toggleOutputFilter(opt.key)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer ${
              isActive ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
            }`}
            title={`Filter by ${opt.label.toLowerCase()} output`}
            type="button"
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
      {outputFilters.size > 0 && (
        <button
          onClick={() => setOutputFilters(new Set())}
          className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-white/0 text-white/60 hover:text-white/90 hover:bg-white/10 border border-white/15 cursor-pointer"
          title="Clear filters"
          type="button"
        >
          Clear
        </button>
      )}
    </div>
  );

  // Render a model item
  const renderModelItem = (model: Model, isFavorite: boolean = false, providerLabel?: string, configuredKeyOverride?: string) => {
    // Resolve provider base for this item (fixed provider wins; otherwise use best-priced mapping)
    const isFixedProvider = !!configuredKeyOverride && configuredKeyOverride.includes('@@');
    const fixedBaseRaw = isFixedProvider ? parseModelKey(configuredKeyOverride!).base : null;
    const fixedBase = normalizeBaseUrl(fixedBaseRaw);
    const mappedBase = normalizeBaseUrl(modelProviderMap[model.id]);
    const baseForPricing = fixedBase || mappedBase;
    const providerModels = baseForPricing ? providerModelCache[baseForPricing] : undefined;
    const providerSpecificModel = providerModels ? providerModels[model.id] : undefined;
    const effectiveModelForPricing = providerSpecificModel || model;
    const isAvailable = isModelAvailable(effectiveModelForPricing);
    const estimatedMinCost = getEstimatedMinCost(effectiveModelForPricing);
    const isFav = isFavorite || isConfiguredModel(model.id);
    const effectiveProviderLabel = providerLabel || formatProviderLabel(baseForPricing, model);
    const isDynamicProvider = !isFixedProvider;
    return (
      <div
        key={`${configuredKeyOverride || model.id}`}
        className={`p-2 text-sm rounded-md transition-colors ${
          !isAvailable 
            ? 'opacity-40 cursor-not-allowed' 
            : selectedModel?.id === model.id
            ? 'bg-white/10 cursor-pointer'
            : 'hover:bg-white/5 cursor-pointer'
        }`}
        onMouseEnter={() => setHoveredModelId(model.id)}
      >
        <div className="flex items-center gap-2">
          {/* Favorite toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleConfiguredModel(configuredKeyOverride || model.id);
            }}
            className={`flex-shrink-0 p-0.5 rounded transition-colors cursor-pointer ${isFav ? 'text-yellow-400 hover:text-yellow-300' : 'text-white/30 hover:text-yellow-400'}`}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            type="button"
          >
            <Star className={`h-3 w-3 ${isFav ? 'fill-current' : ''}`} />
          </button>
          {/* Model Info - Clickable area for selection */}
          <div 
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              if (isAvailable) {
                // If this is a favorite with a fixed provider, persist mapping so selection is fixed
                if (isFixedProvider && fixedBase && setModelProviderFor) {
                  setModelProviderFor(model.id, fixedBase);
                }
                handleModelChange(model.id);
                setIsModelDrawerOpen(false);
              }
            }}
          >
            <div className={`font-medium truncate`}>
              {getModelNameWithoutProvider(model.name)}
            </div>
            <div className="text-xs text-white/50 flex items-center justify-between">
              <span className="text-white/60 truncate pr-2 flex items-center gap-1">
                {isDynamicProvider && (
                  <span title="Dynamic provider: always picks the cheapest based on pricing">~</span>
                )}
                <span className="truncate">{effectiveProviderLabel}</span>
                {isDynamicProvider && (
                  <span className="inline-flex" title="Dynamic provider: always picks the cheapest based on pricing">
                    <Info className="h-3 w-3 text-white/40" />
                  </span>
                )}
              </span>
              <span className="mx-2 flex-shrink-0">{formatTokensPerSat(effectiveModelForPricing?.sats_pricing?.completion)}</span>
              {!isAvailable && estimatedMinCost > 0 && (
                <span className="text-yellow-400 font-medium flex-shrink-0">• Min: {estimatedMinCost.toFixed(0)} sats</span>
              )}
            </div>
          </div>
          
          {/* Selected Indicator */}
          {selectedModel?.id === model.id && (
            <div className={`text-xs font-medium flex-shrink-0 text-green-400`}>
              ✓
            </div>
          )}

          {/* Mobile: Details view navigation trigger */}
          {isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Resolve base for details as well so the details panel fetches correct pricing
                setDetailsModel(model);
                setDetailsBaseUrl(baseForPricing);
                navigateToView('details');
              }}
              className="flex-shrink-0 p-1 rounded-md text-white/60 hover:text-white/90 hover:bg-white/5 cursor-pointer"
              title="View details"
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render model details (shared by desktop pane and mobile popover)
  const renderModelDetails = (model: Model) => {
    // Determine provider base for details: prefer explicit detailsBaseUrl, otherwise mapping
    const baseForDetails = normalizeBaseUrl(detailsBaseUrl) || normalizeBaseUrl(modelProviderMap[model.id]);
    const providerModels = baseForDetails ? providerModelCache[baseForDetails] : undefined;
    const providerSpecificModel = providerModels ? providerModels[model.id] : undefined;
    const effectiveModel = providerSpecificModel || model;
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-white/50">{getProviderFromModelName(effectiveModel.name)}</div>
            <div className="text-base font-semibold truncate">{getModelNameWithoutProvider(effectiveModel.name)}</div>
          </div>
        </div>

        {effectiveModel.description && (
          <div className="text-xs text-white/60 line-clamp-4">
            {effectiveModel.description}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/5 rounded-md p-2 border border-white/10">
            <div className="text-white/60">Context length</div>
            <div className="font-medium">{effectiveModel.context_length?.toLocaleString?.() ?? '—'} tokens</div>
          </div>
          <div className="bg-white/5 rounded-md p-2 border border-white/10">
            <div className="text-white/60">Modality</div>
            <div className="font-medium">{effectiveModel.architecture?.modality ?? '—'}</div>
          </div>
          <div className="bg-white/5 rounded-md p-2 border border-white/10">
            <div className="text-white/60">Tokenizer</div>
            <div className="font-medium">{effectiveModel.architecture?.tokenizer ?? '—'}</div>
          </div>
          <div className="bg-white/5 rounded-md p-2 border border-white/10">
            <div className="text-white/60">Instruct type</div>
            <div className="font-medium">{effectiveModel.architecture?.instruct_type ?? '—'}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-white/60">Pricing</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-md p-2 border border-white/10">
              <div className="text-white/60">Prompt</div>
              <div className="font-medium">
                {formatTokensPerSat(effectiveModel?.sats_pricing?.prompt)}
              </div>
            </div>
            <div className="bg-white/5 rounded-md p-2 border border-white/10">
              <div className="text-white/60">Completion</div>
              <div className="font-medium">
                {formatTokensPerSat(effectiveModel?.sats_pricing?.completion)}
              </div>
            </div>
          </div>
          {(effectiveModel?.sats_pricing?.max_cost || effectiveModel?.sats_pricing?.max_completion_cost) && (
            <div className="text-[11px] text-white/50">
              Est. min: {getEstimatedMinCost(effectiveModel).toFixed(0)} sats
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs text-white/60">Capabilities</div>
          <div className="flex flex-wrap gap-1.5">
            {(effectiveModel?.architecture?.input_modalities?.includes('image') || (effectiveModel?.pricing?.image ?? 0) > 0) && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Images</span>
            )}
            {(effectiveModel?.pricing?.web_search ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Web search</span>
            )}
            {(effectiveModel?.pricing?.internal_reasoning ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">Thinking</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 border border-white/15">{effectiveModel.architecture?.output_modalities?.join(', ') || 'Text output'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        ref={toggleButtonRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (isAuthenticated) {
            setIsModelDrawerOpen(!isModelDrawerOpen);
          } else {
            setIsLoginModalOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isAuthenticated) {
              setIsModelDrawerOpen(!isModelDrawerOpen);
            } else {
              setIsLoginModalOpen(true);
            }
          }
        }}
        aria-expanded={isModelDrawerOpen}
        aria-controls="model-selector-drawer"
        className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-3 sm:px-4 h-[36px] text-xs sm:text-sm transition-colors cursor-pointer border border-white/10 overflow-hidden max-w-[calc(100vw-260px)] sm:max-w-none"
        data-tutorial="model-selector"
        type="button"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium truncate whitespace-nowrap">{selectedModel ? getModelNameWithoutProvider(selectedModel.name) : 'Select Model'}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-white/70 flex-shrink-0" />
      </button>

      {isModelDrawerOpen && isAuthenticated && (
        <div
          ref={modelDrawerRef}
          id="model-selector-drawer"
          className="absolute top-full left-1/2 transform -translate-x-1/2 w-[720px] max-w-[95vw] mt-1 bg-black border border-white/10 rounded-md shadow-lg max-h-[70vh] overflow-hidden z-50"
          onMouseLeave={() => setHoveredModelId(null)}
        >
          {/* Mobile view: page-like transition between list and details */}
          <div className={`sm:hidden transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'} overflow-y-auto max-h-[70vh]`}>
            {activeView === 'list' ? (
              <div>
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
                      className="w-full bg-white/5 border border-white/10 rounded-md py-1 pl-8 pr-10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-2">
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="flex items-center text-white/40 hover:text-white/60"
                          title="Clear"
                          type="button"
                        >
                          <span className="text-xs">×</span>
                        </button>
                      )}
                      {openModelsConfig && (
                        <button
                          onClick={() => openModelsConfig()}
                          className="text-white/60 hover:text-white"
                          title="Configure models"
                          type="button"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isLoadingModels ? (
                  <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[60vh]">
                    {/* Current Model Section */}
                    {selectedModel && (
                      <div className="p-1">
                        <div className="px-2 py-1 text-xs font-medium text-white/60">Current</div>
                        <div className="space-y-1">
                          {renderModelItem(selectedModel, isConfiguredModel(selectedModel.id), currentProviderLabel, currentConfiguredKey)}
                        </div>
                      </div>
                    )}

                    {/* Favorite Models Section */}
                    {favoriteEntries.length > 0 && (
                      <div className="p-1">
                        <div className="px-2 py-1 text-xs font-medium text-white/60">Favorites</div>
                        <div className="space-y-1">
                          {favoriteEntries.map((entry) => renderModelItem(entry.model, true, entry.providerLabel, entry.key))}
                        </div>
                      </div>
                    )}

                    {/* Separator */}
                    {(!!selectedModel || favoriteEntries.length > 0) && remainingModelsList.length > 0 && (
                      <div className="border-t border-white/10 my-1" />
                    )}

                    {/* All Models Section */}
                    <div className="p-1">
                      <div className="px-2 py-1 text-xs font-medium text-white/60">All Models</div>
                      {remainingModelsList.length > 0 ? (
                        <div className="space-y-1">
                          {remainingModelsList.filter(m => m.id !== selectedModel?.id).map((model) => renderModelItem(model, false))}
                        </div>
                      ) : (
                        <div className="p-2 text-sm text-white/50 text-center">No models found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-3">
                <button
                  onClick={() => navigateToView('list')}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer"
                  type="button"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {detailsModel ? (
                  <div className="space-y-3">
                    {renderModelDetails(detailsModel)}
                  </div>
                ) : (
                  <div className="text-sm text-white/50">No model selected</div>
                )}
              </div>
            )}
          </div>

          {/* Desktop view: side-by-side list and details */}
          <div className="hidden sm:grid grid-cols-2">
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
                    className="w-full bg-white/5 border border-white/10 rounded-md py-1 pl-8 pr-10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-2">
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="flex items-center text-white/40 hover:text-white/60"
                        title="Clear"
                        type="button"
                      >
                        <span className="text-xs">×</span>
                      </button>
                    )}
                    {openModelsConfig && (
                      <button
                        onClick={() => openModelsConfig()}
                        className="text-white/60 hover:text-white"
                        title="Configure models"
                        type="button"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {renderQuickFilters()}
              </div>

              {isLoadingModels ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[60vh]">
                  {/* Current Model Section */}
                  {selectedModel && (
                    <div className="p-1">
                      <div className="px-2 py-1 text-xs font-medium text-white/60">Current</div>
                      <div className="space-y-1">
                        {renderModelItem(selectedModel, isConfiguredModel(selectedModel.id), currentProviderLabel, currentConfiguredKey)}
              </div>
                    </div>
                  )}

                  {/* Favorite Models Section */}
                  {favoriteEntries.length > 0 && (
                    <div className="p-1">
                      <div className="px-2 py-1 text-xs font-medium text-white/60">Favorites</div>
                      <div className="space-y-1">
                        {favoriteEntries.map((entry) => renderModelItem(entry.model, true, entry.providerLabel, entry.key))}
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  {(!!selectedModel || favoriteEntries.length > 0) && remainingModelsList.length > 0 && (
                    <div className="border-t border-white/10 my-1" />
                  )}

                  {/* All Models Section */}
                  <div className="p-1">
                    <div className="px-2 py-1 text-xs font-medium text-white/60">All Models</div>
                    {remainingModelsList.length > 0 ? (
                      <div className="space-y-1">
                        {remainingModelsList.filter(m => m.id !== selectedModel?.id).map((model) => renderModelItem(model, false))}
                      </div>
                    ) : (
                      <div className="p-2 text-sm text-white/50 text-center">No models found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Details */}
            <div className="p-3 overflow-y-auto max-h-[70vh]">
              {previewModel ? (
                renderModelDetails(previewModel)
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