// frontend/src/components/PasswordReset.jsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import resetService from '../services/resetService';
import { logger } from '../config/config';

const PasswordReset = ({ onClose, userIP }) => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 請求密碼重置
  const requestReset = async () => {
    if (!userIP) {
      setError('等待IP地址獲取...');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await resetService.requestReset(username, userIP);
      logger.debug('Reset code requested for:', username);
      setStep(2);
    } catch (error) {
      logger.error('Reset request error:', error);
      setError(error.message || '無法提交重置請求');
    } finally {
      setIsLoading(false);
    }
  };

  // 確認重置並設置新密碼
  const confirmReset = async () => {
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await resetService.confirmReset(username, resetCode, newPassword);
      logger.debug('Password reset successful for:', username);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      logger.error('Reset confirmation error:', error);
      setError(error.message || '重置失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (step === 1 && username) {
        requestReset();
      } else if (step === 2 && resetCode && newPassword && confirmPassword) {
        confirmReset();
      }
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md p-6">
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            密碼重置成功！您可以使用新密碼登入了。
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-6">
      <h2 className="text-2xl font-bold mb-6">密碼重置</h2>
      
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">用戶名</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              onKeyPress={handleKeyPress}
              placeholder="請輸入您的用戶名"
              disabled={isLoading}
            />
          </div>
          <p className="text-sm text-gray-600">
            系統將發送重置碼到您的公司郵箱 <br/>
            { `(${username}@shummi.com.tw)`}
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button 
              variant="ghost" 
              onClick={onClose}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button 
              onClick={requestReset}
              disabled={isLoading || !username}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  處理中...
                </>
              ) : '請求重置'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">重置碼</label>
            <Input
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.trim().toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="請輸入收到的重置碼"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">新密碼</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="請輸入新密碼"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">確認新密碼</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="請再次輸入新密碼"
              disabled={isLoading}
            />
          </div>
          <p className="text-sm text-gray-600">
            請輸入至少8個字符的密碼，需包含大小寫字母和數字。
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setStep(1)}
              disabled={isLoading}
            >
              返回
            </Button>
            <Button 
              onClick={confirmReset}
              disabled={isLoading || !resetCode || !newPassword || !confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  處理中...
                </>
              ) : '確認重置'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PasswordReset;