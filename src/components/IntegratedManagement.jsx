// src/components/IntegratedManagement.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, Plus, Edit2, X, Users, Camera } from 'lucide-react';
import authService from '../services/authService';
import { logger } from '../config/config';
import CaptureReport from './CaptureReport';

const IntegratedManagement = () => {
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [newWhitelistUser, setNewWhitelistUser] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState('users');

  // 載入用戶和白名單數據
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await authService.getAdminData();
      setUsers(data.users);
      setWhitelist(data.whitelist);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 使用 useEffect 設定定期重新載入
  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!isSubscribed) return;
      
      try {
        const data = await authService.getAdminData();
        if (isSubscribed) {
          setUsers(data.users || []);
          setWhitelist(data.whitelist || []);
        }
      } catch (error) {
        if (isSubscribed) {
          setError(error.message);
        }
      }
    };

    // 初始載入
    fetchData();

    // 設定定期重新載入
    const interval = setInterval(fetchData, 3000);

    // 清理函數
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);
  
  // 新增用戶
  const handleAddUser = async () => {
    try {
      await authService.adminCreateUser(newUser.username, newUser.password);
      setSuccess('用戶創建成功');
      setNewUser({ username: '', password: '' });
      loadData();
    } catch (error) {
      setError(error.message);
    }
  };

  // 添加重置登入嘗試的處理函數
  const handleResetLoginAttempts = async (username) => {
    try {
      await authService.adminResetLoginAttempts(username);
      setSuccess('用戶登入嘗試已重置');
      loadData(); // 重新載入用戶數據
    } catch (error) {
      setError(error.message);
    }
  };

  // 刪除用戶
  const handleDeleteUser = async (username) => {
    if (username === 'admin') {
      setError('無法刪除 admin 帳號');
      return;
    }
    
    try {
      await authService.adminDeleteUser(username);
      setSuccess('用戶刪除成功');
      loadData();
    } catch (error) {
      setError(error.message);
    }
  };

  // 修改用戶密碼
  const handleUpdatePassword = async () => {
    try {
      await authService.adminUpdateUserPassword(
        editingUser.username,
        editingUser.newPassword
      );
      setSuccess('密碼更新成功');
      setEditingUser(null);
      loadData();
    } catch (error) {
      setError(error.message);
    }
  };

  // 新增白名單
  const handleAddWhitelist = async () => {
    try {
      await authService.adminAddWhitelist(newWhitelistUser);
      setSuccess('白名單新增成功');
      setNewWhitelistUser('');
      loadData();
    } catch (error) {
      setError(error.message);
    }
  };

  // 刪除白名單
  const handleDeleteWhitelist = async (username) => {
    if (username === 'admin') {
      setError('無法從白名單中移除 admin');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      await authService.adminDeleteWhitelist(username);
      
      // 等待一下以確保後端處理完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 重新載入全部資料以確保同步
      await loadData();
      
      setSuccess('白名單成員已移除');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 清除消息提示
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // 自定義頁籤組件
  const TabButton = ({ value, icon, label }) => (
    <button
      className={`px-4 py-2 rounded-md flex items-center ${
        activeTab === value
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      onClick={() => {
        setActiveTab(value);
        clearMessages();
      }}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold mb-6">系統管理</h1>
      
      {/* 錯誤和成功消息 */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 bg-green-50">
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* 自定義頁籤切換 */}
      <div className="flex gap-2 mb-6">
        <TabButton 
          value="users" 
          icon={<Users size={16} />} 
          label="用戶管理" 
        />
        <TabButton 
          value="capture" 
          icon={<Camera size={16} />} 
          label="截圖記錄" 
        />
      </div>
      
      {/* 用戶管理頁籤內容 */}
      {activeTab === 'users' && (
        <>
          {/* 用戶管理 */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">用戶管理</h2>
            
            {/* 新增用戶表單 */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="用戶名"
                value={newUser.username}
                onChange={(e) => setNewUser(prev => ({
                  ...prev,
                  username: e.target.value.trim()
                }))}
              />
              <Input
                type="password"
                placeholder="密碼"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({
                  ...prev,
                  password: e.target.value
                }))}
              />
              <Button
                onClick={handleAddUser}
                disabled={!newUser.username || !newUser.password}
              >
                新增用戶
              </Button>
            </div>

            {/* 用戶列表 */}
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.username} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span>{user.username}</span>
                  <div className="flex gap-2">
                    {user.loginAttempts?.lockUntil && new Date(user.loginAttempts.lockUntil) > new Date() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetLoginAttempts(user.username)}
                      >
                        解除鎖定
                      </Button> 
                    )}

                    {editingUser?.username === user.username ? (
                      <>
                        <Input
                          type="password"
                          placeholder="新密碼"
                          value={editingUser.newPassword || ''}
                          onChange={(e) => setEditingUser(prev => ({
                            ...prev,
                            newPassword: e.target.value
                          }))}
                          className="w-40"
                        />
                        <Button onClick={handleUpdatePassword} size="sm">
                          確認
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditingUser(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser({ username: user.username, newPassword: '' })}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.username)}
                          disabled={user.username === 'admin'}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 白名單管理 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">白名單管理</h2>
            
            {/* 新增白名單表單 */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="用戶名"
                value={newWhitelistUser}
                onChange={(e) => setNewWhitelistUser(e.target.value.trim())}
              />
              <Button
                onClick={handleAddWhitelist}
                disabled={!newWhitelistUser}
              >
                新增白名單
              </Button>
            </div>

            {/* 白名單列表 */}
            <div className="space-y-2">
              {whitelist.map(username => (
                <div key={username} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span>{username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWhitelist(username)}
                    disabled={username === 'admin'}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
      
      {/* 截圖記錄頁籤內容 */}
      {activeTab === 'capture' && <CaptureReport />}
    </div>
  );
};

export default IntegratedManagement;