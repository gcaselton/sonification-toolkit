import { createContext, useState, ReactNode, useContext as useReactContext } from 'react';

// Define the shape of the context
interface AppContextType {
  isSidebarOpen: boolean;
  isModelOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  openModal: () => void;
  closeModal: () => void;
}

// Provide a default value (can be undefined or a mock)
const AppContext = createContext<AppContextType | undefined>(undefined);

// Define the type for the provider's props
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);
  const openModal = () => setIsModelOpen(true);
  const closeModal = () => setIsModelOpen(false);

  return (
    <AppContext.Provider
      value={{ isSidebarOpen, isModelOpen, openSidebar, closeSidebar, openModal, closeModal }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Optional: Custom hook for easier usage
export const useAppContext = (): AppContextType => {
  const context = useReactContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};