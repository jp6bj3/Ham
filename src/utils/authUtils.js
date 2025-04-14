// frontend/src/utils/authUtils.js
import CryptoJS from 'crypto-js';  // 修正導入方式
import { logger } from '../config/config';

// 密碼雜湊
export const hashPassword = async (password) => {
  try {
    return CryptoJS.SHA256(password).toString();  // 修正使用方式
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('密碼處理失敗');
  }
};

// 生成 session token
export const generateSessionToken = () => {
  try {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    logger.error('Session token generation failed:', error);
    throw new Error('Session token 生成失敗');
  }
};

// 生成重置碼
export const generateResetCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 驗證密碼強度
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  if (password.length < minLength) {
    return { isValid: false, message: '密碼長度至少需要8個字符' };
  }
  
  if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
    return { 
      isValid: false, 
      message: '密碼需要包含大寫字母、小寫字母和數字' 
    };
  }

  return { isValid: true };
};

// 驗證登入嘗試
export const validateLoginAttempts = (loginAttempts) => {
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  if (!loginAttempts) {
    return { isLocked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  const now = new Date();
  
  if (loginAttempts.lockUntil && new Date(loginAttempts.lockUntil) > now) {
    const remainingLockTime = Math.ceil(
      (new Date(loginAttempts.lockUntil) - now) / 1000 / 60
    );
    return {
      isLocked: true,
      remainingLockTime,
      message: `帳號已被鎖定，請等待 ${remainingLockTime} 分鐘後重試`
    };
  }

  if (
    loginAttempts.lastAttempt &&
    now - new Date(loginAttempts.lastAttempt) > 24 * 60 * 60 * 1000
  ) {
    return { isLocked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  return {
    isLocked: false,
    remainingAttempts: MAX_ATTEMPTS - (loginAttempts.count || 0)
  };
};

// 更新登入嘗試記錄
export const updateLoginAttempts = (loginAttempts, success) => {
  const now = new Date();
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  if (success) {
    return {
      count: 0,
      lastAttempt: now.toISOString(),
      lockUntil: null
    };
  }

  const newCount = (loginAttempts?.count || 0) + 1;
  return {
    count: newCount,
    lastAttempt: now.toISOString(),
    lockUntil: newCount >= MAX_ATTEMPTS 
      ? new Date(now.getTime() + LOCK_DURATION).toISOString()
      : null
  };
};