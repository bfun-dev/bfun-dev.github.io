import { useState, useCallback } from "react";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  walletAddress: string;
  balance?: string;
}

export function useCustomAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateWalletAddress = () => {
    return `0x${Math.random().toString(16).substr(2, 40)}`;
  };

  const authenticateWithProvider = useCallback(async (provider: string, email?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create user data based on provider
      const userData: AuthUser = {
        id: `${provider}_${Date.now()}`,
        email: email || `user@${provider}.com`,
        firstName: "Demo",
        lastName: "User",
        profileImageUrl: "https://via.placeholder.com/100",
        walletAddress: generateWalletAddress(),
        balance: "1.5"
      };

      // Store user data in localStorage for persistence
      localStorage.setItem("authUser", JSON.stringify(userData));
      
      // Send to backend for registration/login
      const response = await fetch("/api/auth/social-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          userData,
          walletAddress: userData.walletAddress
        })
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.user);
        return result.user;
      } else {
        throw new Error("Authentication failed");
      }
    } catch (error: any) {
      console.error(`${provider} authentication failed:`, error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      localStorage.removeItem("authUser");
      
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });
      
      if (response.ok) {
        setUser(null);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/user");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return userData;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }
    return null;
  }, []);

  return {
    user,
    isLoading,
    error,
    authenticateWithProvider,
    logout,
    checkAuthStatus,
    isAuthenticated: !!user
  };
}