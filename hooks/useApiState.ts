import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Model } from '@/data/models';
import { DEFAULT_BASE_URLS, DEFAULT_MINT_URL } from '@/lib/utils';
import { loadMintUrl, saveMintUrl, loadBaseUrl, saveBaseUrl, loadLastUsedModel, saveLastUsedModel, loadBaseUrlsList, saveBaseUrlsList, migrateCurrentCashuToken } from '@/utils/storageUtils';
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
  fetchModels: (balance: number) => Promise<void>; // Modified to accept balance
  handleModelChange: (modelId: string) => void;
}

/**
 * Custom hook for managing API configuration and model state
 * Handles API endpoint configuration, model fetching and caching,
 * model selection state, and API error handling
 */
export const useApiState = (isAuthenticated: boolean, balance: number): UseApiStateReturn => {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [mintUrl, setMintUrlState] = useState('');
  const [baseUrl, setBaseUrlState] = useState('');
  const [baseUrlsList, setBaseUrlsList] = useState<string[]>([]);
  const [currentBaseUrlIndex, setCurrentBaseUrlIndex] = useState<number>(0);

  // Initialize URLs from storage
  useEffect(() => {
    if (isAuthenticated) {
      const currentMintUrl = loadMintUrl(DEFAULT_MINT_URL);
      setMintUrlState(currentMintUrl);

      const loadedBaseUrls = loadBaseUrlsList();
      setBaseUrlsList(loadedBaseUrls);

      const currentBaseUrl = loadBaseUrl(DEFAULT_BASE_URLS[0]);
      setBaseUrlState(currentBaseUrl);
      console.log('settings agin')

      const initialIndex = loadedBaseUrls.indexOf(currentBaseUrl);
      setCurrentBaseUrlIndex(initialIndex !== -1 ? initialIndex : 0);
    }
  }, [isAuthenticated]);

  // Migrate old cashu token format on load
  useEffect(() => {
    if (baseUrl) {
      migrateCurrentCashuToken(baseUrl);
    }
  }, [baseUrl]);

  // Fetch available models from API and handle URL model selection
  const fetchModels = useCallback(async (currentBalance: number, attempt: number = 0) => {
    const MAX_ATTEMPTS = baseUrlsList.length; // Try each URL once

    try {
      setIsLoadingModels(true);
      const currentUrlToTry = baseUrlsList[currentBaseUrlIndex];
      if (!currentUrlToTry) {
        throw new Error('No base URL available to fetch models.');
      }

      // Ensure the current baseUrl state matches the URL being tried
      if (baseUrl !== currentUrlToTry) {
        setBaseUrlState(currentUrlToTry);
        console.log('agaion ', currentUrlToTry)
        saveBaseUrl(currentUrlToTry);
      }
      
      const response = await fetch(`${currentUrlToTry}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch models from ${currentUrlToTry}: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.models && Array.isArray(data.models)) {
        setModels(data.models);
        let modelToSelect: Model | null = null;

        // Get model ID from URL if present
        const urlModelId = searchParams.get('model');
        if (urlModelId) {
          modelToSelect = data.models.find((m: Model) => m.id === urlModelId) || null;
        }

        // If no URL model or model not found, try last used
        if (!modelToSelect) {
          const lastUsedModelId = loadLastUsedModel();
          if (lastUsedModelId) {
            modelToSelect = data.models.find((m: Model) => m.id === lastUsedModelId) || null;
          }
        }

        // If no URL model or last used model, select the first compatible model
        if (!modelToSelect) {
          const compatibleModels = data.models.filter((m: Model) =>
            m.sats_pricing && currentBalance >= m.sats_pricing.max_cost
          );
          if (compatibleModels.length > 0) {
            modelToSelect = compatibleModels[0];
          }
        }
        
        setSelectedModel(modelToSelect);
        if (modelToSelect) {
          saveLastUsedModel(modelToSelect.id);
        }
      }
    } catch (error) {
      console.error('Error while fetching models', error);
      setModels([]);
      setSelectedModel(null);
      toast.error(`Failed to connect to ${baseUrlsList[currentBaseUrlIndex]}. Trying next provider...`);

      if (attempt < MAX_ATTEMPTS - 1) {
        const nextIndex = (currentBaseUrlIndex + 1) % baseUrlsList.length;
        setCurrentBaseUrlIndex(nextIndex);
        // Recursively call fetchModels with the next URL
        fetchModels(currentBalance, attempt + 1);
      } else {
        // toast.error('All providers failed. Please check your network connection or settings.');
      }
    } finally {
      setIsLoadingModels(false);
    }
  }, [searchParams, baseUrlsList, currentBaseUrlIndex, baseUrl]); // Added baseUrlsList and currentBaseUrlIndex to dependencies

  // Fetch models when baseUrl or balance changes and user is authenticated
  useEffect(() => {
    if (isAuthenticated && baseUrlsList.length > 0) { // Ensure baseUrlsList is loaded
      fetchModels(balance);
    }
  }, [fetchModels, isAuthenticated, balance, baseUrlsList.length]); // Removed baseUrl, added baseUrlsList.length

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
    const updatedBaseUrlsList = loadBaseUrlsList();
    setBaseUrlsList(updatedBaseUrlsList);
    // Update the currentBaseUrlIndex if the URL is found in the list
    const index = updatedBaseUrlsList.indexOf(normalizedUrl);
    if (index !== -1) {
      setCurrentBaseUrlIndex(index);
    }
  }, [baseUrlsList]);

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