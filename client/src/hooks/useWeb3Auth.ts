import { useEffect, useState } from "react";

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
  }
}

interface Web3AuthUser {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  walletAddress: string;
  balance?: string;
}

export function useWeb3Auth() {
  const [user, setUser] = useState<Web3AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingWalletAddress, setPendingWalletAddress] = useState<string | null>(null);
  const [isWalletLogin, setIsWalletLogin] = useState(false);
  const [web3authInstance, setWeb3authInstance] = useState<any>(null);
  const [web3authReady, setWeb3authReady] = useState(false);


  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Preload Web3Auth on app start
  const preloadWeb3Auth = async () => {
    console.log(import.meta.env.VITE_WEB3AUTH_CLIENT_ID)
    try {
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
      
      if (!clientId) {
        console.warn("VITE_WEB3AUTH_CLIENT_ID not found, skipping Web3Auth preload");
        return;
      }

      // Import Web3Auth modules
      const { Web3Auth } = await import("@web3auth/modal");
      const { WEB3AUTH_NETWORK } = await import("@web3auth/base");

      // Initialize Web3Auth instance with explicit no auto-connect
      const web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        sessionTime: 86400, // 24 hours
        enableLogging: false,
      });
      console.log(web3auth)

      // Initialize but don't connect
      await web3auth.init();
      
      // Ensure no auto-connection happens
      // if (web3auth.connected) {
      //   console.log("********************NIGGA IS CONNECTED****************************")
      //   try {
      //     await web3auth.logout();
      //     console.log("Disconnected auto-connected Web3Auth session");
      //   } catch (error) {
      //     console.log("No Web3Auth session to disconnect");
      //   }
      // }
      
      setWeb3authInstance(web3auth);
      setWeb3authReady(true);
      console.log("Web3Auth preloaded and ready");
    } catch (error) {
      console.error("Web3Auth preload failed:", error);
      // Don't block app loading if preload fails
    }
  };

  // Prevent auto-connections on app load
  const preventAutoConnections = () => {
    // Clear Web3Auth auto-login cache
    localStorage.removeItem("Web3Auth-cachedAdapter");
    localStorage.removeItem("openlogin_store");
    localStorage.removeItem("Web3Auth-cachedLogin");
    
    // Disconnect any existing wallet connections silently
    if (window.ethereum && window.ethereum.selectedAddress) {
      // Don't auto-connect to MetaMask
      console.log("Preventing MetaMask auto-connection");
    }
    
    if (window.solana && window.solana.isConnected) {
      // Disconnect Phantom if auto-connected
      try {
        window.solana.disconnect();
        console.log("Disconnected auto-connected Phantom wallet");
      } catch (error) {
        console.log("No Phantom auto-connection to clear");
      }
    }
  };

  useEffect(() => {
    // Prevent any auto-connections first
    preventAutoConnections();
    console.log("checked autoconnection")
    // Then check auth status
    checkAuth();
    console.log("checked auth")
    
    // Preload Web3Auth in the background
    preloadWeb3Auth();
  }, []);

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install MetaMask to connect your wallet.");
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        const walletAddress = accounts[0];
        
        // Check if user exists
        const checkResponse = await fetch(`/api/auth/check-wallet/${walletAddress}`);
        
        if (checkResponse.ok) {
          // User exists, authenticate
          const web3AuthUser: Web3AuthUser = {
            id: walletAddress,
            email: `${walletAddress.substring(0, 8)}@metamask.user`,
            firstName: "MetaMask",
            lastName: "User",
            profileImageUrl: "",
            walletAddress: walletAddress,
          };

          const authResponse = await fetch('/api/auth/web3auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(web3AuthUser),
            credentials: 'include',
          });

          if (authResponse.ok) {
            const userData = await authResponse.json();
            setUser(userData);
            setIsAuthenticated(true);
            window.location.reload();
          }
        } else {
          // New user, show name modal
          setPendingWalletAddress(walletAddress);
          setIsWalletLogin(true);
          setShowNameModal(true);
        }
      }
    } catch (error: any) {
      console.error("MetaMask connection failed:", error);
      
      // Check if user cancelled the connection
      if (error?.code === 4001 || error?.message?.includes("User rejected")) {
        alert("MetaMask connection cancelled. Please try again if you'd like to connect.");
      } else if (error?.code === -32002) {
        alert("MetaMask is already processing a request. Please check MetaMask and try again.");
      } else {
        alert("Failed to connect MetaMask. Please make sure MetaMask is unlocked and try again.");
      }
    }
  };

  const connectPhantom = async () => {
    if (!window.solana?.isPhantom) {
      alert("Phantom wallet is not installed. Please install Phantom to connect your wallet.");
      return;
    }

    try {
      const resp = await window.solana.connect();
      const walletAddress = resp.publicKey.toString();
      console.log(walletAddress)
      // Check if user exists
      const checkResponse = await fetch(`/api/auth/check-wallet/${walletAddress}`);
      
      if (checkResponse.ok) {
        // User exists, authenticate
        const web3AuthUser: Web3AuthUser = {
          id: walletAddress,
          email: `${walletAddress.substring(0, 8)}@phantom.user`,
          firstName: "Phantom",
          lastName: "User",
          profileImageUrl: "",
          walletAddress: walletAddress,
        };

        const authResponse = await fetch('/api/auth/web3auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(web3AuthUser),
          credentials: 'include',
        });

        if (authResponse.ok) {
          const userData = await authResponse.json();
          setUser(userData);
          setIsAuthenticated(true);
          window.location.reload();
        } else {
          throw new Error("Failed to authenticate with backend");
        }
      } else {
        // New user, show name modal
        setPendingWalletAddress(walletAddress);
        setIsWalletLogin(true);
        setShowNameModal(true);
      }

    } catch (error: any) {
      console.error("Phantom connection failed:", error);
      
      // Check if user cancelled the connection
      if (error?.code === 4001 || error?.message?.includes("User rejected") || error?.message?.includes("cancelled")) {
        alert("Phantom wallet connection cancelled. Please try again if you'd like to connect.");
      } else {
        alert("Failed to connect Phantom wallet. Please make sure Phantom is unlocked and try again.");
      }
    }
  };

  const connectWeb3Auth = async () => {
    try {
      setIsConnecting(true);
      console.log("Starting Web3Auth modal connection...");

      let web3auth = web3authInstance;

      // If preloaded instance is not available, create new one
      if (!web3auth || !web3authReady) {
        console.log("Preloaded instance not ready, creating new one...");
        const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
        
        if (!clientId) {
          throw new Error("VITE_WEB3AUTH_CLIENT_ID environment variable is required");
        }
        
        // Import Web3Auth Modal
        const { Web3Auth } = await import("@web3auth/modal");
        const { WEB3AUTH_NETWORK } = await import("@web3auth/base");

        // Initialize Web3Auth Modal
        web3auth = new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
          sessionTime: 86400, // 24 hours
        });

        console.log("Initializing Web3Auth...");
        await web3auth.init();
        console.log("Web3Auth initialized, status:", web3auth.status);
      } else {
        console.log("Using preloaded Web3Auth instance");
      }
      
      // Clear Web3Auth cache to prevent auto-login
      localStorage.removeItem("Web3Auth-cachedAdapter");
      localStorage.removeItem("openlogin_store");
      localStorage.removeItem("Web3Auth-cachedLogin");
      
      // Ensure Web3Auth is disconnected before attempting new connection
      if (web3auth.connected) {
        try {
          await web3auth.logout();
          console.log("Logged out existing Web3Auth session");
        } catch (error) {
          console.log("No existing Web3Auth session to logout");
        }
      }
      
      console.log("Opening Web3Auth modal...");
      const web3authProvider = await web3auth.connect();
      
      console.log("Web3Auth provider received:", !!web3authProvider);
      console.log("Web3Auth connected state:", web3auth.connected);
      console.log("Web3Auth status after connect:", web3auth.status);
        
      if (web3authProvider && web3auth.connected) {
        console.log("Web3Auth connection successful");
        await handleWeb3AuthSuccess(web3auth);
      } else {
        console.error("Web3Auth connection failed - provider:", !!web3authProvider, "connected:", web3auth.connected);
        throw new Error("Web3Auth connection failed");
      }
      
    } catch (error: any) {
      console.error("Web3Auth authentication failed:", error);
      
      // Check if user cancelled the authentication
      if (error?.message?.includes("User closed the modal") || 
          error?.message?.includes("User cancelled") ||
          error?.message?.includes("cancelled") ||
          error?.code === 5113 ||
          error?.name === "UserCancelledError") {
        alert("Authentication cancelled. Please try again if you'd like to sign in.");
      } else {
        alert("Authentication failed. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWeb3AuthSuccess = async (web3auth: any) => {
    try {
      if (!web3auth.provider) {
        throw new Error("No provider available");
      }

      // Get user information
      const userInfo = await web3auth.getUserInfo();
      console.log("Web3Auth user info:", userInfo);
      console.log("Web3Auth authentication details:", {
        connected: web3auth.connected,
        provider: userInfo?.typeOfLogin,
        verifier: userInfo?.verifier,
        verifierId: userInfo?.verifierId,
        email: userInfo?.email,
        name: userInfo?.name
      });

      // Generate deterministic virtual wallet addresses (avoiding all RPC calls)
      const { ethers } = await import('ethers');
      
      // Create deterministic wallet from Web3Auth user data
      const userIdentifier = userInfo.verifierId || userInfo.email || userInfo.sub || 'default';
      const provider = userInfo.typeOfLogin || 'web3auth';
      const seedString = `web3auth_${provider}_${userIdentifier}`;
      const seedHash = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate Ethereum virtual wallet
      const ethWallet = new ethers.Wallet(seedHash);
      const ethAccounts: string[] = [ethWallet.address];
      
      // Generate Solana virtual wallet from same seed
      const seed = ethers.getBytes(seedHash);
      const { Keypair } = await import('@solana/web3.js');
      const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32));
      const solanaAddress = solanaKeypair.publicKey.toString();
      
      console.log("Generated Web3Auth virtual wallets:", {
        ethereum: ethWallet.address,
        solana: solanaAddress,
        provider: provider,
        userIdentifier: userIdentifier
      });

      // Default balances for virtual wallets (will be fetched from backend)
      const ethBalance = "0";
      const solanaBalance = "0";

      // Web3Auth social logins should proceed directly without username prompt
      // Only actual wallet connections (MetaMask/Phantom) need username prompts
      console.log("Web3Auth social login successful, proceeding with authentication");

      // Use the existing social login endpoint that's working
      const socialLoginData = {
        provider: userInfo.typeOfLogin || 'web3auth',
        id: userInfo.verifierId || userInfo.sub || Date.now().toString(),
        email: userInfo.email || null,
        name: userInfo.name || null,
        profileImage: userInfo.profileImage || null,
        ethereumAddress: ethAccounts?.[0] || ethWallet.address,
        solanaAddress: solanaAddress,
      };

      console.log("Sending social login data:", socialLoginData);

      // Use the social login endpoint that successfully processed the Discord login
      const authResponse = await fetch('/api/auth/web3auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(socialLoginData),
        credentials: 'include',
      });

      if (authResponse.ok) {
        const userData = await authResponse.json();
        setUser(userData.user);
        setIsAuthenticated(true);
        console.log("Web3Auth authentication complete");
        
        // Refresh the page to ensure all components update properly
        window.location.reload();
      } else {
        throw new Error("Failed to authenticate with backend");
      }
      
    } catch (error) {
      console.error("Error handling Web3Auth success:", error);
      throw error;
    }
  };

  const login = async (walletType: 'metamask' | 'phantom' | 'web3auth' = 'metamask') => {
    if (walletType === 'phantom') {
      await connectPhantom();
    } else if (walletType === 'web3auth') {
      await connectWeb3Auth();
    } else {
      await connectMetaMask();
    }
  };

  const logout = async () => {
    try {
      // Disconnect all wallet connections
      await disconnectAllWallets();
      
      // Backend logout
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      setIsAuthenticated(false);
      
      // Redirect to main bets page
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const disconnectAllWallets = async () => {
    try {
      console.log("Disconnecting all wallets...");
      
      // Disconnect MetaMask
      if (window.ethereum?.isMetaMask) {
        try {
          // MetaMask doesn't have a direct disconnect method, but we can clear permissions
          if (window.ethereum.request) {
            await window.ethereum.request({
              method: "wallet_revokePermissions",
              params: [{ eth_accounts: {} }]
            }).catch(() => {
              // Fallback: request to switch to a different account (forces re-connection next time)
              window.ethereum.request({
                method: "wallet_requestPermissions",
                params: [{ eth_accounts: {} }]
              }).catch(() => {}); // Ignore errors
            });
          }
          console.log("MetaMask permissions cleared");
        } catch (error) {
          console.log("MetaMask disconnect not fully supported, cleared local state");
        }
      }

      // Disconnect Phantom
      if (window.solana?.isPhantom) {
        try {
          await window.solana.disconnect();
          console.log("Phantom wallet disconnected");
        } catch (error) {
          console.log("Phantom disconnect error:", error);
        }
      }

      // Disconnect Web3Auth
      try {
        const { Web3Auth } = await import("@web3auth/modal");
        const { WEB3AUTH_NETWORK } = await import("@web3auth/base");
        
        const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
        if (!clientId) {
          console.log("No Web3Auth client ID, skipping Web3Auth disconnect");
          return;
        }

        const web3auth = new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        });

        await web3auth.init();
        
        if (web3auth.connected) {
          await web3auth.logout();
          console.log("Web3Auth disconnected");
        }
      } catch (error) {
        console.log("Web3Auth disconnect error:", error);
      }

      // Clear all Web3Auth and wallet-related localStorage data
      localStorage.removeItem("Web3Auth-cachedAdapter");
      localStorage.removeItem("openlogin_store");
      localStorage.removeItem("wallet-connect");
      localStorage.removeItem("walletconnect");
      sessionStorage.clear();
      
      console.log("All wallets disconnected and local storage cleared");
      
    } catch (error) {
      console.error("Error disconnecting wallets:", error);
    }
  };

  const handleNameSubmit = async (firstName: string, lastName: string, username?: string) => {
    if (!pendingWalletAddress) return;

    try {
      const web3AuthUser: Web3AuthUser = {
        id: pendingWalletAddress,
        email: `${pendingWalletAddress.substring(0, 8)}@wallet.user`,
        username: username || undefined,
        firstName,
        lastName,
        profileImageUrl: "",
        walletAddress: pendingWalletAddress,
      };

      const response = await fetch('/api/auth/web3auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(web3AuthUser),
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
        setShowNameModal(false);
        setPendingWalletAddress(null);
        setIsWalletLogin(false);
      } else {
        throw new Error("Failed to create user");
      }
    } catch (error) {
      console.error("User creation failed:", error);
      alert("Failed to create user. Please try again.");
    }
  };

  return {
    user,
    isLoading,
    isConnecting,
    isAuthenticated,
    login,
    logout,
    connectMetaMask,
    connectPhantom,
    connectWeb3Auth,
    showNameModal,
    setShowNameModal,
    pendingWalletAddress,
    handleNameSubmit,
    isWalletLogin,
  };
}