import React, { createContext, useContext, useState } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [forceHideAppBar, setForceHideAppBar] = useState(false);
  return (
    <UIContext.Provider value={{ forceHideAppBar, setForceHideAppBar }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
