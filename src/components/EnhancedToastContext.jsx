// EnhancedToastContext.jsx
import React, { createContext, useState, useContext, useCallback, useRef } from 'react';

// Toast 類型
const TOAST_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CONFIRM: 'confirm' // 新增確認類型
};

// 創建 Context
const EnhancedToastContext = createContext(null);

// Toast 提供者組件
export const EnhancedToastProvider = ({ children }) => {
  // 保存多個通知的陣列
  const [toasts, setToasts] = useState([]);
  
  // 用於生成唯一 ID
  const toastIdCounter = useRef(0);
  
  // 確認對話框的回調函數
  const [confirmCallbacks, setConfirmCallbacks] = useState({
    onConfirm: null,
    onCancel: null
  });

  // 顯示簡單通知的函數
  const showToast = useCallback((message, type = TOAST_TYPES.INFO, duration = 1000, position = 'top') => {
    const id = toastIdCounter.current++;
    
    // 添加新通知到陣列
    setToasts(prev => [
      ...prev,
      { id, message, type, position }
    ]);
    
    // 設定自動隱藏
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  // 顯示確認對話框的函數
  const showConfirm = useCallback((message, onConfirm, onCancel) => {
    const id = toastIdCounter.current++;
    
    // 保存回調函數
    setConfirmCallbacks({
      onConfirm: () => {
        if (onConfirm) onConfirm();
        // 移除確認對話框
        setToasts(prev => prev.filter(toast => toast.id !== id));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        // 移除確認對話框
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }
    });
    
    // 添加確認對話框
    setToasts(prev => [
      ...prev,
      { id, message, type: TOAST_TYPES.CONFIRM, position: 'center' }
    ]);
  }, []);

  // 渲染單個通知
  const renderToast = (toast) => {
    // 普通通知的位置樣式
    const positionStyles = {
      top: 'top-0 left-1/2 transform -translate-x-1/2 mt-4',
      center: 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
    };
    
    // 確認對話框
    if (toast.type === TOAST_TYPES.CONFIRM) {
      return (
        <div key={toast.id} className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <p className="text-gray-700">{toast.message}</p>
            </div>
            <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-2">
              <button 
                onClick={confirmCallbacks.onCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                取消
              </button>
              <button 
                onClick={confirmCallbacks.onConfirm}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // 一般通知
    return (
      <div 
        key={toast.id} 
        className={`fixed ${positionStyles[toast.position]} z-50 px-4 py-2 rounded-md shadow-md text-white bg-gray-500`}
      >
        {toast.message}
      </div>
    );
  };

  return (
    <EnhancedToastContext.Provider value={{ showToast, showConfirm, TOAST_TYPES }}>
      {children}
      
      {/* 渲染所有通知 */}
      {toasts.map(renderToast)}
    </EnhancedToastContext.Provider>
  );
};

// 自定義 Hook 用於組件中
export const useEnhancedToast = () => {
  const context = useContext(EnhancedToastContext);
  if (!context) {
    throw new Error('useEnhancedToast 必須在 EnhancedToastProvider 內使用');
  }
  return context;
};