'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type RoleType = 'manager' | 'individual';

interface RoleContextValue {
  role: RoleType;
  toggleRole: () => void;
  setRole: (r: RoleType) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'individual',
  toggleRole: () => {},
  setRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<RoleType>('individual');
  const toggleRole = () => setRole((r) => (r === 'manager' ? 'individual' : 'manager'));
  return (
    <RoleContext.Provider value={{ role, toggleRole, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
