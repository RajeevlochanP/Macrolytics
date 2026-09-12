import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Instead of a /me endpoint which we don't have, we can try to hit /auth/logout
  // Actually, wait, do we have a /me or profile endpoint in our Backend api?
  // Let's assume we store minimal info in localStorage for display, since HTTP cookie is used for real auth.
  
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await apiClient('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    // The backend sets the HTTP-only cookie automatically
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const register = async (email, password) => {
    const data = await apiClient('/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
