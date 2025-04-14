// src/components/ScreenshotPrevention.js
import React, { useEffect, useState, useRef } from 'react';
import { logger } from '../config/config';
import captureLogger from '../utils/captureLogger'; // 導入優化版日誌記錄器

/**
 * 截圖防護組件 - 提供全局的截圖和列印防護功能
 * 可監測和阻止多種擷取螢幕內容的行為，並記錄嘗試
 * 不依賴 AuthContext，而是直接從 localStorage 獲取用戶信息
 * 整合了優化版captureLogger以提高性能
 */
const ScreenshotPrevention = ({ children }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const lastActionRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const screenShareCheckInterval = useRef(null);
  
  const keyStateRef = useRef({
    winKey: false,
    shiftKey: false,
    sKey: false,
    lastKeyTime: 0,
    lastWinKeyTime: 0,  // 記錄Windows鍵的按下時間
    lastShiftKeyTime: 0, // 記錄Shift鍵的按下時間
    lastSKeyTime: 0      // 記錄S鍵的按下時間
  });
  
  // 初始化時從 localStorage 獲取用戶信息
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (error) {
      // 使用可用的logger方法或fallback到console
      if (logger.error) {
        logger.error('Error getting user from localStorage:', error);
      } else if (logger.log) {
        logger.log('ERROR: Error getting user from localStorage:', error);
      } else {
        console.error('Error getting user from localStorage:', error);
      }
    }
  }, []);
  
  // 記錄嘗試行為 - 使用優化版captureLogger
  const logAction = async (action, details = '') => {
    if (!currentUser) return;
    
    const timestamp = new Date().toISOString();
    const actionId = `${action}-${timestamp}`;
    
    // 避免重複記錄短時間內的相同行為
    if (lastActionRef.current === actionId) return;
    lastActionRef.current = actionId;
    
    // 延遲清除上次操作記錄
    setTimeout(() => {
      if (lastActionRef.current === actionId) {
        lastActionRef.current = null;
      }
    }, 3000);
    
    // 使用captureLogger記錄行為
    captureLogger.logCapture(action, currentUser.username, details);
    
    // 同時輸出到控制台以便調試
    console.log(`Capture log saved: ${action}`, {
      user: currentUser.username,
      action,
      details,
      timestamp
    });
    
    // 記錄到系統日誌 - 使用logger的可用方法
    if (logger.warn) {
      logger.warn(`Screenshot attempt detected: ${action}, by: ${currentUser.username}`);
    } else if (logger.log) {
      logger.log(`WARN: Screenshot attempt detected: ${action}, by: ${currentUser.username}`);
    } else {
      console.warn(`Screenshot attempt detected: ${action}, by: ${currentUser.username}`);
    }
  };
  
  // 顯示警告訊息
  const showWarning = (message) => {
    setWarningMessage(message);
    setIsBlocked(true);
    
    // 清除之前的計時器
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    // 設置新的計時器
    warningTimeoutRef.current = setTimeout(() => {
      setIsBlocked(false);
      setWarningMessage('');
    }, 3000);
  };
  
  // 檢測屏幕共享/錄製
  useEffect(() => {
    // 檢測屏幕共享狀態
    const checkScreenCapture = async () => {
      try {
        if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
          // 由於這是一個檢測函數，我們不需要真正使用getDisplayMedia
          logAction('screen_capture_check', 'Periodic check');
        }
        
        return false;
      } catch (error) {
        console.log('Screen capture detection error:', error);
        return false;
      }
    };
    
    // 定期檢查屏幕共享狀態
    if (currentUser) {
      screenShareCheckInterval.current = setInterval(() => {
        checkScreenCapture();
      }, 10000); // 每10秒檢查一次
    }
    
    return () => {
      if (screenShareCheckInterval.current) {
        clearInterval(screenShareCheckInterval.current);
      }
    };
  }, [currentUser]);
  
  // 主要的截圖防護邏輯
  useEffect(() => {
    if (!currentUser) return; // 未登入則不啟用防護
    
    console.log('Screenshot prevention active for user:', currentUser.username);
    try {
      // 1. 嘗試攔截全局的 keyup 和 keydown 事件
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'keydown' || type === 'keyup') {
          const wrappedListener = function(event) {
            // 檢查是否為 Print Screen 鍵
            if (event.key === 'PrintScreen' || event.code === 'PrintScreen' || event.keyCode === 44 || 
                event.which === 44 || event.key === 'Snapshot' || event.code === 'Snapshot') {
              console.log('全局EventTarget攔截: Print Screen 鍵被按下', event.type);
              event.preventDefault();
              event.stopPropagation();
              showWarning('截圖功能已被禁用，請與設計師申請圖片');
              logAction('PrintScreen截圖', `通過EventTarget: ${event.type}`);
              return false;
            }
            
            // 如果不是 Print Screen，則調用原始監聽器
            return listener.apply(this, arguments);
          };
          
          // 調用原始方法，但使用我們的包裝監聽器
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        
        // 對非按鍵事件使用原始方法
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // 2. 攔截 document.onkeydown 和 document.onkeyup
      const originalDocOnKeyDown = Object.getOwnPropertyDescriptor(Document.prototype, 'onkeydown');
      const originalDocOnKeyUp = Object.getOwnPropertyDescriptor(Document.prototype, 'onkeyup');
      
      if (originalDocOnKeyDown && originalDocOnKeyDown.set) {
        Object.defineProperty(Document.prototype, 'onkeydown', {
          set: function(handler) {
            const wrappedHandler = function(event) {
              // 檢查是否為 Print Screen 鍵
              if (event.key === 'PrintScreen' || event.code === 'PrintScreen' || event.keyCode === 44 || event.which === 44) {
                console.log('Document.onkeydown 攔截: Print Screen 鍵被按下');
                event.preventDefault();
                event.stopPropagation();
                showWarning('截圖功能已被禁用，請與設計師申請圖片');
                logAction('PrintScreen截圖', 'Document.onkeydown');
                return false;
              }
              
              // 如果不是 Print Screen，則調用原始處理器
              return handler.apply(this, arguments);
            };
            
            originalDocOnKeyDown.set.call(this, wrappedHandler);
          },
          get: originalDocOnKeyDown.get
        });
      }
      
      if (originalDocOnKeyUp && originalDocOnKeyUp.set) {
        Object.defineProperty(Document.prototype, 'onkeyup', {
          set: function(handler) {
            const wrappedHandler = function(event) {
              // 檢查是否為 Print Screen 鍵
              if (event.key === 'PrintScreen' || event.code === 'PrintScreen' || event.keyCode === 44 || event.which === 44) {
                console.log('Document.onkeyup 攔截: Print Screen 鍵被按下');
                event.preventDefault();
                event.stopPropagation();
                showWarning('截圖功能已被禁用，請與設計師申請圖片');
                logAction('PrintScreen截圖', 'Document.onkeyup');
                return false;
              }
              
              // 如果不是 Print Screen，則調用原始處理器
              return handler.apply(this, arguments);
            };
            
            originalDocOnKeyUp.set.call(this, wrappedHandler);
          },
          get: originalDocOnKeyUp.get
        });
      }
      
      // 3. 添加一個立即處理 Print Screen 的全局事件監聽器
      window.document.documentElement.addEventListener('keydown', function(e) {
        // 檢查是否為 Print Screen 鍵
        if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44 || e.which === 44) {
          console.log('根元素 keydown: Print Screen 鍵被按下');
          e.preventDefault();
          e.stopPropagation();
          showWarning('截圖功能已被禁用，請與設計師申請圖片');
          logAction('PrintScreen截圖', 'documentElement keydown');
          return false;
        }
      }, { capture: true, passive: false });
      
      // 4. 在全局窗口對象上設置事件處理程序
      const originalWindowKeyDown = window.onkeydown;
      window.onkeydown = function(e) {
        // 檢查是否為 Print Screen 鍵
        if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44 || e.which === 44) {
          console.log('window.onkeydown: Print Screen 鍵被按下');
          e.preventDefault();
          e.stopPropagation();
          showWarning('截圖功能已被禁用，請與設計師申請圖片');
          logAction('PrintScreen截圖', 'window.onkeydown');
          return false;
        }
        
        // 如果不是 Print Screen，則調用原始處理器
        if (originalWindowKeyDown) {
          return originalWindowKeyDown.call(this, e);
        }
      };
      
      console.log('高級 Print Screen 攔截已設置');
    } catch (error) {
      console.error('設置高級 Print Screen 攔截時出錯:', error);
    }
    // 改進的按鍵處理 - 處理順序按鍵而非僅同時按鍵
const handleKeyDown = (e) => {
  const keyState = keyStateRef.current;
  const now = Date.now();
  
  // 更新最後按鍵時間
  keyState.lastKeyTime = now;
  
 // Windows/Meta 鍵檢測 - 必須先檢測這個，以便正確記錄Win鍵按下時間
if (e.key === 'Meta' || e.metaKey || e.keyCode === 91 || e.keyCode === 92 || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight') {
  keyState.winKey = true;
  keyState.lastWinKeyTime = now; // 記錄按下時間
  console.log('Win key detected, time:', now);
  
  // 新增: 檢查是否已經按下了Shift，如果是則檢查是否即將形成Shift→Win→S組合
  if (keyState.shiftKey || (now - keyState.lastShiftKeyTime < 3000)) {
    e.preventDefault();
    e.stopPropagation();
       showWarning('截圖功能已被禁用，請與設計師申請圖片');
       logAction('windows截圖', `Win+Shift+S (Shift先按，Win後按)`);
    
    // 檢查S鍵是否已經按下或在最近3秒內被按過
    if (keyState.sKey || (now - keyState.lastSKeyTime < 3000)) {
      e.preventDefault();
      e.stopPropagation();
      showWarning('截圖功能已被禁用，請與設計師申請圖片');
      logAction('windows截圖', `Win+Shift+S (Shift先按，Win後按)`);
      
      // 重置按鍵狀態
      keyState.lastWinKeyTime = 0;
      keyState.lastShiftKeyTime = 0;
      keyState.lastSKeyTime = 0;
      keyState.winKey = false;
      keyState.shiftKey = false;
      keyState.sKey = false;
      
      return false;
    }
  }
}

// Shift 鍵檢測
if (e.key === 'Shift' || e.shiftKey || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
  keyState.shiftKey = true;
  keyState.lastShiftKeyTime = now; // 記錄按下時間
  console.log('Shift key detected, time:', now);
  
  // 如果Win和S鍵都已經按下，攔截Shift作為最後一個按鍵的情況
  if ((keyState.winKey || (now - keyState.lastWinKeyTime < 3000)) && 
      (keyState.sKey || (now - keyState.lastSKeyTime < 3000))) {
    e.preventDefault();
    e.stopPropagation();
    showWarning('截圖功能已被禁用，請與設計師申請圖片');
    logAction('windows截圖', `Win+Shift+S (Shift最後按)`);
    
    // 重置按鍵狀態
    keyState.lastWinKeyTime = 0;
    keyState.lastShiftKeyTime = 0;
    keyState.lastSKeyTime = 0;
    keyState.winKey = false;
    keyState.shiftKey = false;
    keyState.sKey = false;
    
    return false;
  }
}

// S 鍵檢測 (必須放在Win和Shift按鍵檢測之後)
if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') {
  keyState.sKey = true;
  keyState.lastSKeyTime = now;
  console.log('S key detected, time:', now);
  
  // 檢查所有可能的按鍵組合 - 任何順序的Win+Shift+S
  const isWinActive = keyState.winKey || (now - keyState.lastWinKeyTime < 3000);
  const isShiftActive = keyState.shiftKey || (now - keyState.lastShiftKeyTime < 3000);
  
  // 如果Win和Shift都處於活動狀態，則阻止
  if (isWinActive && isShiftActive) {
    e.preventDefault();
    e.stopPropagation();
    
    // 通過時間戳判斷按鍵順序，用於日誌
    let sequence = "未知順序";
    const timestamps = [
      { key: 'Win', time: keyState.lastWinKeyTime },
      { key: 'Shift', time: keyState.lastShiftKeyTime },
      { key: 'S', time: now }
    ].filter(item => item.time > 0)
     .sort((a, b) => a.time - b.time);
    
    if (timestamps.length === 3) {
      sequence = timestamps.map(t => t.key).join('->');
    }
    
    showWarning('截圖功能已被禁用，請與設計師申請圖片');
    logAction('windows截圖', `Win+Shift+S (${sequence}) (TimeWin: ${now - keyState.lastWinKeyTime}ms, TimeShift: ${now - keyState.lastShiftKeyTime}ms)`);
    
    // 重置按鍵時間，避免重複觸發
    keyState.lastWinKeyTime = 0;
    keyState.lastShiftKeyTime = 0;
    keyState.lastSKeyTime = 0;
    keyState.winKey = false;
    keyState.shiftKey = false;
    keyState.sKey = false;
    
    return false;
  }
}
  
  // 模式二：同時按鍵檢測（作為備用方案）
  if (keyState.winKey && keyState.shiftKey && keyState.sKey) {
    e.preventDefault();
    e.stopPropagation();
    showWarning('截圖功能已被禁用，請與設計師申請圖片');
    logAction('windows截圖', 'Win+Shift+S (Simultaneous)');
    
    // 重置按鍵狀態以避免重複觸發
    keyState.winKey = false;
    keyState.shiftKey = false;
    keyState.sKey = false;
    keyState.lastWinKeyTime = 0;
    keyState.lastShiftKeyTime = 0;
    
    return false;
  }
      
      // ----- 其他截圖相關快捷鍵 -----
      
      // Windows 截圖快捷鍵
      const isPrintScreenKey = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;
      const isAltPrintScreen = e.altKey && (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44);
      
      // macOS 截圖快捷鍵
      const isMacScreenshot = e.metaKey && e.shiftKey && 
                             (e.key === '3' || e.key === '4' || e.key === '5'); // Cmd+Shift+3/4/5
      const isMacScreenshotControl = e.metaKey && e.shiftKey && e.ctrlKey && 
                                    (e.key === '3' || e.key === '4'); // Cmd+Shift+Ctrl+3/4
      
      // ----- 其他禁用功能快捷鍵 -----
      const isPrintKey = (e.ctrlKey && (e.key === 'p' || e.key === 'P')) || 
                       (e.metaKey && (e.key === 'p' || e.key === 'P')); // Ctrl+P 或 Cmd+P
      const isSaveKey = (e.ctrlKey && (e.key === 's' || e.key === 'S')) || 
                       (e.metaKey && (e.key === 's' || e.key === 'S')); // Ctrl+S 或 Cmd+S
      const isDevToolsKey = 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) || // Ctrl+Shift+J
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) || // Ctrl+Shift+C
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i')) ||   // Cmd+Alt+I (macOS)
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'));                 // Ctrl+U (查看源代码)
      
      // Windows 狀態欄截圖 (Win+PrtScr)
      const isWinPrintScreen = (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) && 
                               (e.metaKey || e.key === 'Meta' || e.keyCode === 91 || e.keyCode === 92);
      
      // 檢測截圖快捷鍵
      if (isPrintScreenKey || isAltPrintScreen || isWinPrintScreen) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('檢測到 Windows 截圖嘗試');
        logAction('windows截圖', `Key combination: ${describeKeyCombo(e)}`);
        return false;
      }
      
      if (isMacScreenshot || isMacScreenshotControl) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('檢測到 macOS 截圖嘗試');
        logAction('macos截圖', `Key combination: ${describeKeyCombo(e)}`);
        return false;
      }
      
      // 檢測其他功能鍵
      if (isPrintKey) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('列印功能已被禁用');
        logAction('嘗試列印', `Key combination: ${describeKeyCombo(e)}`);
        return false;
      }
      
      if (isSaveKey) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('儲存功能已被禁用');
        logAction('嘗試儲存', `Key combination: ${describeKeyCombo(e)}`);
        return false;
      }
      
      if (isDevToolsKey) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('開發者工具已被禁用');
        logAction('嘗試開啟開發者工具', `Key combination: ${describeKeyCombo(e)}`);
        return false;
      }
    };
    
    // 改進的按鍵釋放處理
    const handleKeyUp = (e) => {
      const keyState = keyStateRef.current;
      
      // 更新按鍵狀態
      if (e.key === 'Meta' || e.metaKey || e.keyCode === 91 || e.keyCode === 92 || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight') {
        keyState.winKey = false;
      }
      
      if (e.key === 'Shift' || e.shiftKey || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keyState.shiftKey = false;
      }
      
      if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') {
        keyState.sKey = false;
      }
    };
    
    // 在窗口失焦時重置按鍵狀態
    const handleWindowBlur = () => {
      const keyState = keyStateRef.current;
      keyState.winKey = false;
      keyState.shiftKey = false;
      keyState.sKey = false;
    };
    
    // 當用户離開頁面前檢測
    const handleBeforeUnload = (e) => {
      // 如果有按鍵組合存在，可能是嘗試截圖後立即關閉頁面
      const keyState = keyStateRef.current;
      if (keyState.winKey && keyState.shiftKey) {
        logAction('page_unload_with_keys', 'Possible screenshot attempt');
      }
    };
    
    // 幫助函數：生成按鍵組合的描述
    const describeKeyCombo = (e) => {
      let combo = [];
      if (e.ctrlKey) combo.push('Ctrl');
      if (e.altKey) combo.push('Alt');
      if (e.shiftKey) combo.push('Shift');
      if (e.metaKey) combo.push('Meta/Win/Cmd');
      combo.push(e.key);
      return combo.join('+');
    };
    
    // 定期清除過時的按鍵狀態
    const keyStateCleanupInterval = setInterval(() => {
      const keyState = keyStateRef.current;
      const now = Date.now();
      
      // 如果最後一次按鍵事件超過5秒，重置所有按鍵狀態
      if (now - keyState.lastKeyTime > 5000) {
        keyState.winKey = false;
        keyState.shiftKey = false;
        keyState.sKey = false;
      }
      
      // 如果超過10秒，重置所有時間戳
      if (now - Math.max(keyState.lastWinKeyTime, keyState.lastShiftKeyTime, keyState.lastSKeyTime) > 10000) {
        keyState.lastWinKeyTime = 0;
        keyState.lastShiftKeyTime = 0;
        keyState.lastSKeyTime = 0;
      }
    }, 1000);
    
    // 監測視窗可見性變化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 可能切換到截圖工具
        const timestamp = Date.now();
        
        // 當用戶返回時，檢查時間間隔
        const visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            const timeDiff = Date.now() - timestamp;
            
            // 如果時間間隔很短，可能是截圖行為
            if (timeDiff < 1500) {
              logAction('視窗轉換(可能的截圖行為，也可能誤判)', `Duration: ${timeDiff}ms`);
              showWarning('檢測到可能的截圖行為');
            }
            
            // 移除一次性的監聽器
            document.removeEventListener('visibilitychange', visibilityHandler);
          }
        };
        
        document.addEventListener('visibilitychange', visibilityHandler);
      }
    };
    
// 攔截所有可能的Windows鍵相關事件
document.addEventListener('keydown', function(e) {
  if (e.key === 'Meta' || e.metaKey || e.keyCode === 91 || e.keyCode === 92 || e.key === 'OS') {
    // 這將全面攔截Windows鍵，無論是單獨按下還是組合鍵
    e.preventDefault();
    e.stopPropagation();
    
    // 記錄並顯示警告（僅當單獨按下Windows鍵時）
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
      showWarning('Windows 鍵已被禁用');
      
      // 修復 logAction 調用，確保參數格式正確
      logAction('windows_key_full_block', { event: 'Windows key intercepted' });
      // 或者使用這種格式:
      // logAction('windows_key_full_block', 'Windows key intercepted');
    }
    
    return false;
  }
}, true); // 使用capture模式確保在事件冒泡前攔截
    
    
    // 處理打印嘗試
    const handleBeforePrint = () => {
      showWarning('列印功能已被禁用');
      logAction('嘗試列印', 'Print dialog attempted');
    };
    
    // 新增全局事件攔截 - 這可以捕獲更多的快捷鍵組合
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      if (type === 'keydown' || type === 'keyup' || type === 'keypress') {
        // 先讓我們的處理程序運行
        return originalAddEventListener.call(this, type, function(e) {
          // 檢查是否是截圖相關組合
          const keyState = keyStateRef.current;
          const now = Date.now();
          
          // 檢測順序按鍵 (S 鍵被按下時檢查之前是否有 Win 和 Shift)
          if (type === 'keydown' && 
              (e.key === 's' || e.key === 'S' || e.code === 'KeyS') && 
              now - keyState.lastWinKeyTime < 3000 && 
              now - keyState.lastShiftKeyTime < 3000) {
            e.stopImmediatePropagation();
            e.preventDefault();
            showWarning('Windows截圖功能(Win+Shift+S)已被禁用');
            logAction('Windows截圖', 'Win+Shift+S (Sequential)');
            
            // 重置時間戳
            keyState.lastWinKeyTime = 0;
            keyState.lastShiftKeyTime = 0;
            
            return false;
          }
          
          // 如果不是截圖組合，正常執行監聽器
          listener.apply(this, arguments);
        }, options);
      }
      
      // 非按鍵事件正常處理
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    // 添加事件監聽器 - 使用 capture 階段
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleWindowBlur);
    
    // 添加HTML2Canvas檢測
    const checkForHtml2Canvas = () => {
      if (window.html2canvas) {
        logAction('嘗試使用屏幕捕捉工具', 'Library detected in window object');
        showWarning('檢測到屏幕捕捉工具');
      }
    };
    
    // 定期檢查
    const intervalId = setInterval(checkForHtml2Canvas, 2000);
    
    // 添加截圖後處理
    const originalDocumentElementInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...originalDocumentElementInnerHTML,
      set: function(value) {
        // 檢測是否在短時間內大幅修改DOM
        if (this === document.documentElement && value.length > 1000) {
          logAction('dom_manipulation', `Size: ${value.length}`);
        }
        return originalDocumentElementInnerHTML.set.call(this, value);
      }
    });
    
    // 添加浮水印
    const addWatermark = () => {
      if (!currentUser) return;
      
      // 移除舊的浮水印
      const existingWatermark = document.getElementById('screenshot-watermark');
      if (existingWatermark) {
        existingWatermark.remove();
      }
      
      // 創建浮水印容器
      const watermark = document.createElement('div');
      watermark.id = 'screenshot-watermark';
      watermark.style.position = 'fixed';
      watermark.style.top = '0';
      watermark.style.left = '0';
      watermark.style.width = '100vw';
      watermark.style.height = '100vh';
      watermark.style.pointerEvents = 'none';
      watermark.style.zIndex = '9999999'; // 非常高的z-index
      
      // 添加到body
      document.body.appendChild(watermark);
      
      // 創建Canvas元素
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      // 將Canvas添加到浮水印容器
      watermark.appendChild(canvas);
      
      // 配置Canvas
      const ctx = canvas.getContext('2d');
      
      // 設置字體和樣式
      ctx.font = '16px Arial';
      ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
      
      // 設置旋轉
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6); // 約-30度
      
      // 當前時間戳
      const timestamp = new Date().toLocaleString('zh-TW');
      
      // 計算位置偏移
      const xOffset = canvas.width / 4;
      const yOffset = 50;
      
      // 繪製重複的浮水印
      const text = `${currentUser.username} ${timestamp}`;
      for (let y = -canvas.height; y < canvas.height; y += yOffset) {
        for (let x = -canvas.width; x < canvas.width; x += xOffset) {
          ctx.fillText(text, x, y);
        }
      }
      
      ctx.restore();
    };
    
    // 初始化浮水印並設置調整大小時重繪
    addWatermark();
    window.addEventListener('resize', addWatermark);
    
    // 嘗試攔截屏幕共享 API
    let originalGetDisplayMedia = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        logAction('display_media_request', JSON.stringify(args[0] || {}));
        showWarning('螢幕共享功能已被禁用');
        return Promise.reject(new Error('Screen sharing is disabled'));
      };
    }
  
    
    // 加強型防截圖：使用 MutationObserver 監控DOM變化
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 檢查是否新增了截圖相關元素
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 檢查是否是可能的截圖工具元素
              if (node.id && node.id.toLowerCase().includes('screenshot')) {
                logAction('dom_screenshot_element', `ID: ${node.id}`);
                showWarning('檢測到截圖工具元素');
              }
            }
          }
        }
      }
    });
    
    // 開始觀察整個文檔
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // 日誌事件到控制台，便於調試
    console.log('Screenshot prevention initialized with optimized logger');
    
    // 清理函數
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('resize', addWatermark);
      window.removeEventListener('blur', handleWindowBlur);
      
      clearInterval(keyStateCleanupInterval);
      clearInterval(intervalId);
      
      // 停止DOM觀察
      observer.disconnect();
      
      // 恢復原始innerHTML行為
      Object.defineProperty(Element.prototype, 'innerHTML', originalDocumentElementInnerHTML);
      
      // 移除浮水印
      const watermark = document.getElementById('screenshot-watermark');
      if (watermark) {
        watermark.remove();
      }
      
      // 清除警告計時器
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      
      // 恢復屏幕共享 API
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
      

      
      // 恢復原始事件監聽器
      if (window.addEventListener !== originalAddEventListener) {
        window.addEventListener = originalAddEventListener;
      }
      
      // 確保最後一次刷新日誌
      captureLogger.flushAllLogs();
      
      console.log('Screenshot prevention cleanup completed');
    };
  }, [currentUser]);
  
  return (
    <>
      {children}
      
      {isBlocked && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[99999]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-auto text-center">
            <div className="text-red-600 text-3xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">安全警告</h3>
            <p className="text-gray-700 mb-4">{warningMessage}</p>
            <p className="text-sm text-red-500 mb-4">此行為已被記錄並通知管理員</p>
            <button 
              onClick={() => setIsBlocked(false)} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
            >
              我了解了
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ScreenshotPrevention;