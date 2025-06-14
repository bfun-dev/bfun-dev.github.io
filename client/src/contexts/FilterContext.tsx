import { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
  selectedCategories: number[];
  setSelectedCategories: (categories: number[]) => void;
  status: 'active' | 'resolved' | 'all';
  setStatus: (status: 'active' | 'resolved' | 'all') => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [status, setStatus] = useState<'active' | 'resolved' | 'all'>('all');

  return (
    <FilterContext.Provider value={{
      selectedCategories,
      setSelectedCategories,
      status,
      setStatus
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}