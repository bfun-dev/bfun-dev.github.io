import { useState, useEffect, createContext, useContext } from "react";

interface AdminAuthContext {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContext | null>(null);

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    // Return default values when used outside provider
    const [token, setToken] = useState<string | null>(() => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('admin_token');
      }
      return null;
    });

    useEffect(() => {
      if (token) {
        localStorage.setItem('admin_token', token);
      } else {
        localStorage.removeItem('admin_token');
      }
    }, [token]);

    return {
      token,
      setToken,
      isAuthenticated: !!token,
    };
  }
  return context;
}

export function getAdminToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
}