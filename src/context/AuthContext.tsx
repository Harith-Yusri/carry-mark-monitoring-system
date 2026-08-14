import React, { createContext, useContext, useState, ReactNode } from "react";
import { Role } from "../types";

export interface User {
  id: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (id: string, password: string, role: Role) => boolean;
  logout: () => void;
}

const SESSION_KEY = "carrymark_session";

export const DEMO_ACCOUNTS: Record<Role, { id: string; password: string; name: string }> = {
  lecturer: { id: "TS003", password: "lecturer123", name: "Dr. Siti Rahimah" },
  admin: { id: "ADM001", password: "admin123", name: "Faculty Administrator" },
};

function loadSession(): User | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as User : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(loadSession);

  const login = (id: string, password: string, role: Role) => {
    const account = DEMO_ACCOUNTS[role];
    if (id.trim().toUpperCase() !== account.id || password !== account.password) return false;
    const newUser: User = { id: account.id, name: account.name, role };
    setUser(newUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return true;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
