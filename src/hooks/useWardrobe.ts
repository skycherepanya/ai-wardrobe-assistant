import { useState, useEffect, useCallback } from 'react';
import {
  wardrobeRepo,
  type WardrobeItem,
} from '../db/db';

export function useWardrobe() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await wardrobeRepo.getAllItems();
      setItems(data);
    } catch (err) {
      console.error('[useWardrobe] Failed to fetch items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (
      newItem: Omit<WardrobeItem, 'id' | 'isClean' | 'createdAt'> & {
        isClean?: boolean;
      }
    ) => {
      const item = await wardrobeRepo.addItem(newItem);
      await refresh();
      return item;
    },
    [refresh]
  );

  const toggleClean = useCallback(
    async (id: string, isClean: boolean) => {
      await wardrobeRepo.toggleCleanStatus(id, isClean);
      await refresh();
    },
    [refresh]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await wardrobeRepo.deleteItem(id);
      await refresh();
    },
    [refresh]
  );

  const markOutfitWorn = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await wardrobeRepo.toggleCleanStatus(id, false);
      }
      await refresh();
    },
    [refresh]
  );

  const markAllClean = useCallback(async () => {
    for (const item of items) {
      if (!item.isClean) {
        await wardrobeRepo.toggleCleanStatus(item.id, true);
      }
    }
    await refresh();
  }, [items, refresh]);

  const cleanItems = items.filter((i) => i.isClean);
  const dirtyItems = items.filter((i) => !i.isClean);

  return {
    items,
    cleanItems,
    dirtyItems,
    isLoading,
    refresh,
    addItem,
    toggleClean,
    deleteItem,
    markOutfitWorn,
    markAllClean,
  };
}
