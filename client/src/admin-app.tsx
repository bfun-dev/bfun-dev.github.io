import { useState, useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { adminQueryClient } from "./lib/adminQueryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import AdminLogin from "@/pages/admin-login";
import AdminPanel from "@/pages/admin";

function AdminRouter() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing admin token in localStorage
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      // Verify token with server
      fetch('/api/admin/verify', {
        headers: {
          'Authorization': `Bearer ${savedToken}`,
        },
      })
      .then(res => {
        if (res.ok) {
          setAdminToken(savedToken);
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('admin_token');
        }
      })
      .catch(() => {
        localStorage.removeItem('admin_token');
      })
      .finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('admin_token', token);
    setAdminToken(token);
    setIsAdminAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setIsAdminAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-lg">Loading admin portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {isAdminAuthenticated ? (
        <AdminPanel onLogout={handleLogout} adminToken={adminToken} />
      ) : (
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

function AdminApp() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="admin-theme">
        <TooltipProvider>
          <Toaster />
          <Router base="/admin">
            <AdminRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default AdminApp;