// frontend/src/config/config.js

const ENV = {
    development: {
      API_BASE_URL: 'http://localhost:8000/api',
      FILE_BASE_URL: 'http://localhost:8000',
      EMAIL_DOMAIN: 'shummi.com.tw',
      DEBUG: true
    },
    production: {
      API_BASE_URL: 'https://cheese-4t58.onrender.com/api',
      FILE_BASE_URL: 'https://jp6bj3.github.io/Ham',
      EMAIL_DOMAIN: 'shummi.com.tw',
      DEBUG: false
    }
  };
  
  // 環境判斷函數
  export const isDevelopment = () => {
    return Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('192.168.')
    );
  };
  
  export const isProduction = () => !isDevelopment();
  
  // 當前環境配置
  export const config = ENV[isDevelopment() ? 'development' : 'production'];
  
  // 日誌函數
  export const logger = {
    debug: (...args) => {
      if (config.DEBUG) {
        console.log('[DEBUG]', ...args);
      }
    },
    error: (...args) => {
      console.error('[ERROR]', ...args);
    }
  };
  