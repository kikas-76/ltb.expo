import { createContext, useContext, useState, ReactNode } from 'react';

interface DeepLinkContextType {
  pendingListingId: string | null;
  setPendingListingId: (id: string | null) => void;
}

const DeepLinkContext = createContext<DeepLinkContextType | undefined>(undefined);

export function DeepLinkProvider({ children }: { children: ReactNode }) {
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);

  return (
    <DeepLinkContext.Provider value={{ pendingListingId, setPendingListingId }}>
      {children}
    </DeepLinkContext.Provider>
  );
}

export function useDeepLink() {
  const context = useContext(DeepLinkContext);
  if (!context) {
    throw new Error('useDeepLink must be used within a DeepLinkProvider');
  }
  return context;
}
