// src/utils/captureLogger.js
import { logger } from '../config/config';
import { isDevelopment } from '../config/config';

/**
 * 統一的日誌記錄方法，確保相容性
 * @private
 */
const log = {
  warn: function(message, ...args) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(message, ...args);
    } else if (logger && typeof logger.log === 'function') {
      logger.log('WARN: ' + message, ...args);
    } else {
      console.warn(message, ...args);
    }
  },
  error: function(message, ...args) {
    if (logger && typeof logger.error === 'function') {
      logger.error(message, ...args);
    } else if (logger && typeof logger.log === 'function') {
      logger.log('ERROR: ' + message, ...args);
    } else {
      console.error(message, ...args);
    }
  },
  info: function(message, ...args) {
    if (logger && typeof logger.info === 'function') {
      logger.info(message, ...args);
    } else if (logger && typeof logger.log === 'function') {
      logger.log('INFO: ' + message, ...args);
    } else {
      console.info(message, ...args);
    }
  },
  debug: function(message, ...args) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(message, ...args);
    } else if (logger && typeof logger.log === 'function') {
      logger.log('DEBUG: ' + message, ...args);
    } else {
      console.debug(message, ...args);
    }
  }
};

/**
 * 優化版截圖行為記錄工具
 * 用於記錄用戶的截圖、列印和其他螢幕捕捉行為
 * 實現了批處理、優先級隊列、智能事件合併等優化機制
 */
export class CaptureLogger {
  constructor() {
    this.logQueue = [];           // 普通優先級日誌隊列
    this.highPriorityQueue = [];  // 高優先級日誌隊列
    this.lastLoggedAction = {};   // 記錄每種行為的最後時間
    this.actionCounts = {};       // 記錄每種行為的計數器
    this.isProcessing = false;    // 處理鎖，防止並發請求
    this.batchInterval = null;    // 批處理計時器
    this.retryInterval = null;    // 重試計時器
    this.maxQueueSize = 10;       // 普通隊列最大大小
    this.batchIntervalTime = 30000; // 批處理間隔時間
    this.retryIntervalTime = 60000; // 重試間隔時間
    
    // 加載失敗的日誌
    this.loadFailedLogs();
    
    // 啟動批處理
    this.startBatchProcessing();
    
    // 啟動重試機制
    this.startRetryMechanism();
    
    // 頁面卸載前發送剩餘日誌
    window.addEventListener('beforeunload', () => this.flushAllLogs());
  }
  
  /**
   * 高優先級事件列表
   * 這些事件將被立即發送到服務器
   */
  get highPriorityEvents() {
    return [
      'screenshot_key',        // 使用截圖鍵
      'devtools_open',         // 開啟開發者工具
      'devtools_key',          // 開發者工具快捷鍵
      'html2canvas',           // 檢測到 HTML2Canvas 使用
      'html2canvas_detected',  // HTML2Canvas 檢測變體名稱
      'dom_capture',           // DOM 捕獲
      'print_attempt',         // 嘗試列印
      'print_attempt_blocked', // 嘗試列印被阻止
      'multiple_attempts',     // 短時間內多次嘗試
      'windows_screenshot_key',// Windows 截圖快捷鍵
      'macos_screenshot_key',  // macOS 截圖快捷鍵
      'dom_screenshot_element',// 檢測到DOM截圖元素
      'display_media_request', // 螢幕共享請求
      'visibility_switch'      // 視窗切換(可能的截圖行為)
    ];
  }
  
  /**
   * 記錄捕獲行為
   * @param {string} action - 操作類型
   * @param {string} username - 用戶名
   * @param {object} details - 額外詳情
   */
  logCapture(action, username, details = {}) {
    // 防止未登錄用戶的記錄
    if (!username) return;
    
    const now = Date.now();
    const key = `${action}-${username}`;
    
    // 智能合併相似連續事件
    if (this.lastLoggedAction[key] && now - this.lastLoggedAction[key] < 5000) {
      this.actionCounts[key] = (this.actionCounts[key] || 0) + 1;
      
      // 每5次相同操作才記錄一次，除非是高優先級事件
      if (this.actionCounts[key] < 5 && !this.highPriorityEvents.includes(action)) {
        return;
      }
      
      // 添加重複次數到詳情
      if (this.actionCounts[key] > 1) {
        details.repeated = this.actionCounts[key];
      }
      this.actionCounts[key] = 0;
    }
    
    this.lastLoggedAction[key] = now;
    
    // 創建日誌對象 (使用簡短的字段名以減少數據大小)
    const logData = {
      a: action,                          // action
      u: username,                        // user
      t: new Date().toISOString(),        // timestamp
      d: typeof details === 'string' ? details : JSON.stringify(details), // details
      url: window.location.pathname,      // 當前頁面路徑
      ua: navigator.userAgent.substring(0, 100) // 用戶代理(限制長度)
    };
    
    if (isDevelopment()) {
      log.warn(`[CaptureLogger] 記錄行為 (開發模式): ${action}`, logData);
      return;
    }
    
    // 本地存儲備份
    this.saveToLocalStorage(logData);
    
    // 使用優先級分類處理日誌
    if (this.highPriorityEvents.includes(action)) {
      // 高優先級事件添加到高優先級隊列
      this.highPriorityQueue.push(logData);
      this.processHighPriorityQueue();
    } else {
      // 普通事件添加到普通隊列
      this.logQueue.push(logData);
      
      // 當隊列長度達到閾值時立即處理
      if (this.logQueue.length >= this.maxQueueSize) {
        this.processBatch();
      }
    }
  }
  
  /**
   * 處理高優先級隊列
   * @private
   */
  async processHighPriorityQueue() {
    if (this.highPriorityQueue.length === 0 || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 取出當前隊列中所有日誌
      const batch = [...this.highPriorityQueue];
      this.highPriorityQueue = [];
      
      // 發送日誌
      await this.sendLogs(batch);
      
      if (isDevelopment()) {
        log.info(`[CaptureLogger] 已發送 ${batch.length} 條高優先級日誌`);
      }
    } catch (error) {
      log.error('[CaptureLogger] 發送高優先級日誌失敗:', error);
      // 保存失敗的日誌以便稍後重試
      this.saveFailedLogs([...this.highPriorityQueue]);
      // 清空隊列避免重複發送
      this.highPriorityQueue = [];
    } finally {
      this.isProcessing = false;
      
      // 如果隊列中還有新日誌，則繼續處理
      if (this.highPriorityQueue.length > 0) {
        // 使用setTimeout避免遞歸調用過深
        setTimeout(() => this.processHighPriorityQueue(), 100);
      }
    }
  }
  
  /**
   * 啟動批處理機制
   * @private
   */
  startBatchProcessing() {
    // 清除舊計時器
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    
    // 設置新計時器
    this.batchInterval = setInterval(() => {
      this.processBatch();
    }, this.batchIntervalTime);
    
    log.debug(`[CaptureLogger] 批處理機制已啟動，間隔 ${this.batchIntervalTime / 1000} 秒`);
  }
  
  /**
   * 啟動重試機制
   * @private
   */
  startRetryMechanism() {
    // 清除舊計時器
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    
    // 設置新計時器
    this.retryInterval = setInterval(() => {
      this.retryFailedLogs();
    }, this.retryIntervalTime);
    
    log.debug(`[CaptureLogger] 重試機制已啟動，間隔 ${this.retryIntervalTime / 1000} 秒`);
  }
  
  /**
   * 處理普通日誌批次
   * @private
   */
  async processBatch() {
    if (this.logQueue.length === 0) {
      return;
    }
    
    // 已有處理中的請求，等待下次
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 取出當前隊列中所有日誌
      const batch = [...this.logQueue];
      this.logQueue = [];
      
      // 發送日誌
      await this.sendLogs(batch);
      
      if (isDevelopment()) {
        log.debug(`[CaptureLogger] 已發送 ${batch.length} 條普通日誌`);
      }
    } catch (error) {
      log.error('[CaptureLogger] 發送普通日誌批次失敗:', error);
      // 保存失敗的日誌以便稍後重試
      this.saveFailedLogs(this.logQueue);
      // 清空隊列避免重複發送
      this.logQueue = [];
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * 發送日誌到服務器
   * @private
   * @param {Array} logs - 要發送的日誌數組
   * @returns {Promise<object>} - 發送結果
   */
  async sendLogs(logs) {
    if (!logs || logs.length === 0) {
      return { success: true, count: 0 };
    }
    
    try {
      // 根據日誌數量決定是單條發送還是批量發送
      const payload = logs.length === 1 ? logs[0] : { batch: logs };
      
      const response = await fetch('/api/public/log-capture.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        // 添加憑證，確保會話Cookie被發送
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      log.error('[CaptureLogger] 發送日誌失敗:', error);
      throw error;
    }
  }
  
  /**
   * 保存到本地儲存
   * @private
   * @param {object} logData - 日誌數據
   */
  saveToLocalStorage(logData) {
    try {
      // 保存到 capture_logs
      const captureLogsString = localStorage.getItem('capture_logs');
      const captureLogs = captureLogsString ? JSON.parse(captureLogsString) : [];
      captureLogs.push(logData);
      
      // 限制大小
      const trimmedCaptureLogs = captureLogs.slice(-100);
      localStorage.setItem('capture_logs', JSON.stringify(trimmedCaptureLogs));
      
      // 同時保存到 screenshot_logs (保持向後兼容)
      const screenshotLogsString = localStorage.getItem('screenshot_logs');
      const screenshotLogs = screenshotLogsString ? JSON.parse(screenshotLogsString) : [];
      screenshotLogs.push(logData);
      const trimmedScreenshotLogs = screenshotLogs.slice(-100);
      localStorage.setItem('screenshot_logs', JSON.stringify(trimmedScreenshotLogs));
    } catch (error) {
      log.error('[CaptureLogger] 保存到本地儲存失敗:', error);
    }
  }
  
  /**
   * 從本地儲存加載失敗的日誌
   * @private
   */
  loadFailedLogs() {
    try {
      const failedLogsString = localStorage.getItem('failed_capture_logs');
      if (failedLogsString) {
        const failedLogs = JSON.parse(failedLogsString);
        log.debug(`[CaptureLogger] 從本地儲存加載了 ${failedLogs.length} 條失敗的日誌`);
        
        // 將失敗的日誌添加到高優先級隊列，優先處理
        if (failedLogs.length > 0) {
          this.highPriorityQueue.push(...failedLogs);
          // 清空失敗日誌存儲
          localStorage.removeItem('failed_capture_logs');
        }
      }
    } catch (error) {
      log.error('[CaptureLogger] 加載失敗日誌出錯:', error);
    }
  }
  
  /**
   * 保存失敗的日誌到本地儲存
   * @private
   * @param {Array} logs - 失敗的日誌數組
   */
  saveFailedLogs(logs) {
    if (!logs || logs.length === 0) {
      return;
    }
    
    try {
      const failedLogsString = localStorage.getItem('failed_capture_logs');
      const failedLogs = failedLogsString ? JSON.parse(failedLogsString) : [];
      failedLogs.push(...logs);
      
      // 限制數量
      const trimmedFailedLogs = failedLogs.slice(-100);
      localStorage.setItem('failed_capture_logs', JSON.stringify(trimmedFailedLogs));
      
      log.warn(`[CaptureLogger] 已將 ${logs.length} 條失敗的日誌保存到本地儲存`);
    } catch (error) {
      log.error('[CaptureLogger] 保存失敗日誌出錯:', error);
    }
  }
  
  /**
   * 嘗試重新發送失敗的日誌
   * @private
   */
  async retryFailedLogs() {
    try {
      const failedLogsString = localStorage.getItem('failed_capture_logs');
      if (!failedLogsString) {
        return;
      }
      
      const failedLogs = JSON.parse(failedLogsString);
      if (failedLogs.length === 0) {
        return;
      }
      
      log.debug(`[CaptureLogger] 嘗試重新發送 ${failedLogs.length} 條失敗的日誌`);
      
      // 一次最多重試10條
      const logsToRetry = failedLogs.splice(0, Math.min(10, failedLogs.length));
      
      // 如果已有處理中的請求，跳過本次重試
      if (this.isProcessing) {
        return;
      }
      
      this.isProcessing = true;
      
      try {
        await this.sendLogs(logsToRetry);
        // 更新失敗日誌列表
        localStorage.setItem('failed_capture_logs', JSON.stringify(failedLogs));
        log.debug(`[CaptureLogger] 成功重新發送 ${logsToRetry.length} 條日誌`);
      } catch (error) {
        log.error('[CaptureLogger] 重試失敗:', error);
        // 重新添加失敗的日誌
        this.saveFailedLogs(logsToRetry);
      } finally {
        this.isProcessing = false;
      }
    } catch (error) {
      log.error('[CaptureLogger] 重試失敗日誌過程出錯:', error);
      this.isProcessing = false;
    }
  }
  
  /**
   * 頁面卸載前發送所有日誌
   * @private
   */
  flushAllLogs() {
    // 合併所有隊列
    const allLogs = [...this.highPriorityQueue, ...this.logQueue];
    if (allLogs.length === 0) {
      return;
    }
    
    log.warn(`[CaptureLogger] 頁面卸載，嘗試發送 ${allLogs.length} 條未處理的日誌`);
    
    // 使用同步XMLHttpRequest
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/public/log-capture.php', false); // 同步請求，確保在頁面卸載前發送
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ batch: allLogs, emergency: true }));
    } catch (error) {
      // 在頁面卸載過程中無法處理錯誤，只能盡力發送
      console.error('[CaptureLogger] 頁面卸載時發送日誌失敗:', error);
    }
  }
  
  /**
   * 釋放資源
   */
  dispose() {
    // 清除計時器
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    
    // 發送所有未處理的日誌
    this.flushAllLogs();
    
    // 移除事件監聽器
    window.removeEventListener('beforeunload', () => this.flushAllLogs());
    
    log.debug('[CaptureLogger] 資源已釋放');
  }
}

// 創建單例實例
const captureLogger = new CaptureLogger();

export default captureLogger;