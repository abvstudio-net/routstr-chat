import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Model } from '@/data/models';
import { DEFAULT_BASE_URL, DEFAULT_MINT_URL } from '@/lib/utils';
import { loadMintUrl, saveMintUrl, loadBaseUrl, saveBaseUrl, loadLastUsedModel, saveLastUsedModel } from '@/utils/storageUtils';
import { toast } from 'sonner';

export interface UseApiStateReturn {
  models: Model[];
  selectedModel: Model | null;
  isLoadingModels: boolean;
  mintUrl: string;
  baseUrl: string;
  setModels: (models: Model[]) => void;
  setSelectedModel: (model: Model | null) => void;
  setIsLoadingModels: (loading: boolean) => void;
  setMintUrl: (url: string) => void;
  setBaseUrl: (url: string) => void;
  fetchModels: () => Promise<void>;
  handleModelChange: (modelId: string) => void;
}

/**
 * Custom hook for managing API configuration and model state
 * Handles API endpoint configuration, model fetching and caching,
 * model selection state, and API error handling
 */
export const useApiState = (isAuthenticated: boolean): UseApiStateReturn => {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [mintUrl, setMintUrlState] = useState('');
  const [baseUrl, setBaseUrlState] = useState('');

  // Initialize URLs from storage
  useEffect(() => {
    if (isAuthenticated) {
      const currentMintUrl = loadMintUrl(DEFAULT_MINT_URL);
      const currentBaseUrl = loadBaseUrl(DEFAULT_BASE_URL);
      
      setMintUrlState(currentMintUrl);
      setBaseUrlState(currentBaseUrl);
    }
  }, [isAuthenticated]);

  // Fetch available models from API and handle URL model selection
  const fetchModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      if (!baseUrl) return;
      
      const response = await fetch(`${baseUrl}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.models && Array.isArray(data.models)) {
        setModels(data.models);

        // Get model ID from URL if present
        const urlModelId = searchParams.get('model');

        if (urlModelId) {
          // Find the model from the URL parameter
          const urlModel = data.models.find((m: Model) => m.id === urlModelId);
          if (urlModel) {
            setSelectedModel(urlModel);
            saveLastUsedModel(urlModelId);
            return;
          }
        }

        // If no URL model or model not found, use last used or first available
        const lastUsedModelId = loadLastUsedModel();
        if (lastUsedModelId) {
          const lastModel = data.models.find((m: Model) => m.id === lastUsedModelId);
          if (lastModel) {
            setSelectedModel(lastModel);
          } else if (data.models.length > 0) {
            setSelectedModel(data.models[0]);
          }
        } else if (data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
      }
    } catch (error) {
      console.error('Error while fetching models', error);
      setModels([]);
      setSelectedModel(null);
      toast.error('The provider might not be available');
    } finally {
      setIsLoadingModels(false);
    }
  }, [searchParams, baseUrl]);

  // Fetch models when baseUrl changes and user is authenticated
  useEffect(() => {
    if (isAuthenticated && baseUrl) {
      fetchModels();
    }
  }, [baseUrl, fetchModels, isAuthenticated]);

  const handleModelChange = useCallback((modelId: string) => {
    const model = models.find((m: Model) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      saveLastUsedModel(modelId);
    }
  }, [models]);

  const setMintUrl = useCallback((url: string) => {
    setMintUrlState(url);
    saveMintUrl(url);
  }, []);

  const setBaseUrl = useCallback((url: string) => {
    const normalizedUrl = url.endsWith('/') ? url : `${url}/`;
    setBaseUrlState(normalizedUrl);
    saveBaseUrl(normalizedUrl);
  }, []);

  return {
    models,
    selectedModel,
    isLoadingModels,
    mintUrl,
    baseUrl,
    setModels,
    setSelectedModel,
    setIsLoadingModels,
    setMintUrl,
    setBaseUrl,
    fetchModels,
    handleModelChange
  };
};