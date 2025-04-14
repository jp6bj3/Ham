// frontend/src/components/Auth.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import authService from '../services/authService';
import PasswordReset from './PasswordReset';
import { logger } from '../config/config';

const Auth = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedSession = localStorage.getItem('authSession');
        const savedUser = localStorage.getItem('user');

        if (savedSession && savedUser) {
          const { username, token } = JSON.parse(savedSession);
          if (await authService.validateSession(username, token)) {
            onLogin(JSON.parse(savedUser));
          } else {
            localStorage.removeItem('authSession');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        logger.error('Auth initialization error:', error);
        setError('初始化失敗，請重新整理頁面');
      }
    };

    initAuth();
  }, [onLogin]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await authService.login(
        credentials.username,
        credentials.password
      );

      localStorage.setItem('authSession', JSON.stringify({
        username: result.user.username,
        token: result.session.token
      }));
      localStorage.setItem('user', JSON.stringify(result.user));

      logger.debug('Login successful:', result.user.username);
      onLogin(result.user);
    } catch (error) {
      logger.error('Login error:', error);
      setError(error.message || '登入失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && credentials.username && credentials.password) {
      handleLogin();
    }
  };

  if (showResetPassword) {
    return <PasswordReset onClose={() => setShowResetPassword(false)} />;
  }

  return (
    <Card className="w-full max-w-md p-6">
      <h2 className="text-2xl font-bold mb-6">用戶登入</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">用戶名</label>
          <Input
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials(prev => ({
              ...prev,
              username: e.target.value.trim()
            }))}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            placeholder="請輸入用戶名"
            className="w-full"
          />
           <p className="text-sm text-gray-600 pt-2">
           與公司信箱名稱一致，方便未來重設密碼 <br/>
            {`(${credentials.username}@shummi.com.tw)`}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密碼</label>
          <Input
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials(prev => ({
              ...prev,
              password: e.target.value
            }))}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            placeholder="密碼需要包含大寫字母、小寫字母和數字"
            className="w-full"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button 
          className="w-full"
          onClick={handleLogin}
          disabled={isLoading || !credentials.username || !credentials.password}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              處理中...
            </>
          ) : '登入/註冊'}
        </Button>
        <Button
          variant="link"
          className="w-full"
          onClick={() => setShowResetPassword(true)}
          disabled={isLoading}
        >
          忘記密碼？
        </Button>
      </div>
    </Card>
  );
};

export default Auth;