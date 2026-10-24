import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fleetguard_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fleetguard_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifyUser() {
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem('fleetguard_user', JSON.stringify(profile));
        } catch (e) {
          // Token expired or invalid
          logout();
        }
      } else {
        // Provide default guest operator demo session so user can explore without login friction
        setUser({
          id: 'guest-operator',
          name: 'Demo Fleet Operator',
          email: 'operator@fleetguard.io',
          role: 'ADMIN',
          createdAt: new Date().toISOString()
        });
      }
      setLoading(false);
    }
    verifyUser();
  }, [token]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('fleetguard_token', res.token);
    localStorage.setItem('fleetguard_user', JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fleetguard_token');
    localStorage.removeItem('fleetguard_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
