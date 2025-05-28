import { useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Model } from '@/types/chat';
import { getModelNameWithoutProvider } from '@/data/models';

interface ModelSelectorProps {
  selectedModel: Model | null;
  isModelDrawerOpen: boolean;
  setIsModelDrawerOpen: (isOpen: boolean) => void;
  isAuthenticated: boolean;
  setIsLoginModalOpen: (isOpen: boolean) => void;
  isLoadingModels: boolean;
  filteredModels: Model[];
  handleModelChange: (modelId: string) => void;
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
}: ModelSelectorProps) {
  const modelDrawerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative">
      <button
        onClick={() => isAuthenticated ? setIsModelDrawerOpen(!isModelDrawerOpen) : setIsLoginModalOpen(true)}
        className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-4 h-[36px] text-sm transition-colors cursor-pointer border border-white/10"
        data-tutorial="model-selector"
      >
        <span className="font-medium">{selectedModel ? getModelNameWithoutProvider(selectedModel.name) : 'Select Model'}</span>
        <ChevronDown className="h-4 w-4 text-white/70" />
      </button>

      {isModelDrawerOpen && isAuthenticated && (
        <div
          ref={modelDrawerRef}
          className="absolute top-full left-1/2 transform -translate-x-1/2 w-64 mt-1 bg-black border border-white/10 rounded-md shadow-lg max-h-60 overflow-y-auto z-50"
        >
          {isLoadingModels ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
            </div>
          ) : (
            <div className="p-1">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`p-2 text-sm rounded-md cursor-pointer ${selectedModel?.id === model.id
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                    }`}
                  onClick={() => {
                    handleModelChange(model.id);
                    setIsModelDrawerOpen(false);
                  }}
                >
                  <div className="font-medium">{getModelNameWithoutProvider(model.name)}</div>
                  <div className="text-xs text-white/50">{model.sats_pricing.completion.toFixed(4)} sats</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 