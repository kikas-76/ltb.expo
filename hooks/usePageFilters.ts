import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FilterState,
  DEFAULT_FILTERS,
  CategoryOption,
} from '@/components/explore/FilterPanel';

export function usePageFilters() {
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, value')
      .order('order', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setCategories(
            data.map((c: any) => ({ id: c.id, name: c.name, value: c.value ?? '' }))
          );
        }
      });
  }, []);

  const openPanel = () => {
    setPendingFilters(filters);
    setPendingCategoryIds(selectedCategoryIds);
    setFilterPanelVisible(true);
  };

  const closePanel = () => setFilterPanelVisible(false);

  const applyPanel = () => {
    setFilters(pendingFilters);
    setSelectedCategoryIds(pendingCategoryIds);
    setFilterPanelVisible(false);
  };

  const toggleCategory = (id: string) => {
    setPendingCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const activeFilterCount = [
    filters.sortKey !== 'recent',
    filters.ownerType !== 'all',
    filters.priceMin !== '' || filters.priceMax !== '',
    selectedCategoryIds.length > 0,
    filters.locationMode !== 'none',
  ].filter(Boolean).length;

  return {
    filterPanelVisible,
    filters,
    pendingFilters,
    categories,
    selectedCategoryIds,
    pendingCategoryIds,
    activeFilterCount,
    openPanel,
    closePanel,
    applyPanel,
    setPendingFilters,
    toggleCategory,
    setFilters,
    setSelectedCategoryIds,
  };
}
