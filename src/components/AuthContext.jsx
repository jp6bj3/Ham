// src/components/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 從 localStorage 獲取當前用戶信息
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value = {
    user,
    setUser,
    loading,
    login: async (username, password) => {
      try {
        const result = await authService.login(username, password);
        if (result.success) {
          const userData = {
            username: result.user.username,
            // 可以添加其他需要的用戶信息
          };
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('authSession', JSON.stringify(result.session));
          return { success: true };
        }
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    },
    logout: () => {
      localStorage.removeItem('authSession');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};