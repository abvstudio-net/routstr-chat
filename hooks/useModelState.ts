import { useState, useEffect, useCallback } from 'react';
import { loadFavoriteModels, saveFavoriteModels } from '@/utils/storageUtils';

export interface UseModelStateReturn {
  favoriteModels: string[];
  setFavoriteModels: (models: string[]) => void;
  toggleFavoriteModel: (modelId: string) => void;
}

/**
 * Custom hook for managing model selection and preferences
 * Handles model filtering and search, favorite models management,
 * model availability checking, and model change handling
 */
export const useModelState = (): UseModelStateReturn => {
  const [favoriteModels, setFavoriteModelsState] = useState<string[]>([]);

  // Load favorite models from storage on mount
  useEffect(() => {
    const savedFavoriteModels = loadFavoriteModels();
    setFavoriteModelsState(savedFavoriteModels);
  }, []);

  // Toggle favorite model
  const toggleFavoriteModel = useCallback((modelId: string) => {
    setFavoriteModelsState(prev => {
      const updated = prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId];
      saveFavoriteModels(updated);
      return updated;
    });
  }, []);

  const setFavoriteModels = useCallback((models: string[]) => {
    setFavoriteModelsState(models);
    saveFavoriteModels(models);
  }, []);

  return {
    favoriteModels,
    setFavoriteModels,
    toggleFavoriteModel
  };
};