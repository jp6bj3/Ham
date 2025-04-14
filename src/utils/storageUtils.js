// utils/storageUtils.js

// 設定固定的儲存空間上限為 50MB
const STORAGE_LIMIT = 50 * 1024 * 1024; // 50MB in bytes

// 計算字串的位元組大小
export const getStringBytes = (str) => {
  return new Blob([str]).size;
};

// 計算物件的儲存大小
export const calculateObjectSize = (obj) => {
  return getStringBytes(JSON.stringify(obj));
};

// 格式化檔案大小顯示
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 計算儲存空間資訊
export async function getStorageEstimate() {
  try {
    const usage = localStorage.getItem('storageUsage') 
      ? parseInt(localStorage.getItem('storageUsage'))
      : 0;

    return {
      quota: STORAGE_LIMIT,
      usage: usage,
      available: STORAGE_LIMIT - usage
    };
  } catch (error) {
    console.error('Error getting storage estimate:', error);
    return {
      quota: STORAGE_LIMIT,
      usage: 0,
      available: STORAGE_LIMIT
    };
  }
}

// 更新使用量
export const updateStorageUsage = (newUsage) => {
  try {
    localStorage.setItem('storageUsage', newUsage.toString());
  } catch (error) {
    console.error('Error updating storage usage:', error);
  }
};