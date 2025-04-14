// ListContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';

// 數據庫連接池管理
let dbInstance = null;
let dbInitializing = false;
let dbInitPromise = null;

// 初始化 IndexedDB
const initDB = () => {
  // 如果已經有連接且未關閉，直接返回
  if (dbInstance && !dbInstance.closed) {
    return Promise.resolve(dbInstance.connection);
  }
  
  // 如果正在初始化，返回初始化 Promise
  if (dbInitializing && dbInitPromise) {
    return dbInitPromise;
  }
  
  // 開始初始化
  dbInitializing = true;
  dbInitPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open('productListsDB', 1);

    request.onerror = () => {
      dbInitializing = false;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      const connection = request.result;
      
      // 監聽連接關閉事件
      connection.onclose = () => {
        if (dbInstance) {
          dbInstance.closed = true;
        }
      };
      
      // 儲存連接到實例
      dbInstance = {
        connection,
        closed: false,
        lastUsed: Date.now()
      };
      
      dbInitializing = false;
      resolve(connection);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('lists')) {
        db.createObjectStore('lists', { keyPath: 'listName' });
      }
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };
  });
  
  return dbInitPromise;
};

// 定期檢查並清理未使用的連接
const cleanupDBConnection = () => {
  const now = Date.now();
  const maxIdleTime = 60000; // 60 秒未使用則關閉
  
  if (dbInstance && !dbInstance.closed && (now - dbInstance.lastUsed > maxIdleTime)) {
    dbInstance.connection.close();
    dbInstance.closed = true;
    console.log('關閉閒置的產品清單數據庫連接');
  }
};

// 每分鐘檢查一次閒置連接
setInterval(cleanupDBConnection, 60000);

// 創建 Context
const ListContext = createContext();

// Provider 組件
export const ListProvider = ({ children }) => {
  const [savedLists, setSavedLists] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // 初始化數據庫並加載數據
  useEffect(() => {
    const initialize = async () => {
      try {
        const db = await initDB();
        
        // 更新最後使用時間
        if (dbInstance) {
          dbInstance.lastUsed = Date.now();
        }
        
        // 從 IndexedDB 加載清單數據，使用單一事務
        const transaction = db.transaction(['lists'], 'readonly');
        const store = transaction.objectStore('lists');
        const request = store.getAll();

        request.onsuccess = () => {
          const lists = {};
          request.result.forEach(item => {
            lists[item.listName] = item.products;
          });
          setSavedLists(lists);
          setIsLoading(false);
        };
        
        request.onerror = (error) => {
          console.error('Error loading lists:', error);
          setIsLoading(false);
        };
      } catch (error) {
        console.error('Error initializing database:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // 批量保存修改，使用節流技術減少寫入次數
  useEffect(() => {
    if (!isLoading && pendingChanges.length > 0 && !isSaving) {
      const saveBatch = async () => {
        try {
          setIsSaving(true);
          const db = await initDB();
          
          // 更新最後使用時間
          if (dbInstance) {
            dbInstance.lastUsed = Date.now();
          }
          
          // 使用單一事務進行批量操作
          const transaction = db.transaction(['lists'], 'readwrite');
          const store = transaction.objectStore('lists');
          
          // 只在批次保存的最後一步清除所有數據
          if (pendingChanges.includes('clear')) {
            await new Promise((resolve, reject) => {
              const clearRequest = store.clear();
              clearRequest.onsuccess = resolve;
              clearRequest.onerror = reject;
            });
          }
          
          // 批量添加所有列表
          const addPromises = Object.entries(savedLists).map(([listName, products]) => 
            new Promise((resolve, reject) => {
              const addRequest = store.put({
                listName,
                products
              });
              addRequest.onsuccess = resolve;
              addRequest.onerror = reject;
            })
          );
          
          await Promise.all(addPromises);
          setPendingChanges([]);
        } catch (error) {
          console.error('Error saving lists:', error);
        } finally {
          setIsSaving(false);
        }
      };
      
      // 延遲執行，以合併短時間內的多次修改
      const timeoutId = setTimeout(saveBatch, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingChanges, savedLists, isLoading, isSaving]);

  // 覆寫 setSavedLists 以跟踪修改
  const updateSavedLists = (newListsOrFunction) => {
    setSavedLists(prevLists => {
      const newLists = typeof newListsOrFunction === 'function' 
        ? newListsOrFunction(prevLists) 
        : newListsOrFunction;
      
      // 記錄待保存的修改
      setPendingChanges(prev => [...prev, 'clear']);
      
      return newLists;
    });
  };

  // 保存圖片到 IndexedDB，合併操作到單一事務
  const saveImagesBatch = async (images) => {
    if (!dbInstance || dbInstance.closed) {
      await initDB();
    }
    
    // 更新最後使用時間
    if (dbInstance) {
      dbInstance.lastUsed = Date.now();
    }
    
    const db = dbInstance.connection;
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    
    const promises = images.map(({ imageId, imageData }) => 
      new Promise((resolve, reject) => {
        const request = store.put({
          id: imageId,
          data: imageData
        });
        
        request.onsuccess = () => resolve(imageId);
        request.onerror = () => reject(request.error);
      })
    );
    
    return Promise.all(promises);
  };

  // 單個圖片保存 (兼容舊API)
  const saveImage = async (imageId, imageData) => {
    try {
      const results = await saveImagesBatch([{ imageId, imageData }]);
      return results[0];
    } catch (error) {
      console.error('Error saving image:', error);
      return null;
    }
  };

  // 從 IndexedDB 批量獲取圖片
  const getImagesBatch = async (imageIds) => {
    if (!dbInstance || dbInstance.closed) {
      await initDB();
    }
    
    // 更新最後使用時間
    if (dbInstance) {
      dbInstance.lastUsed = Date.now();
    }
    
    const db = dbInstance.connection;
    const transaction = db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    
    const promises = imageIds.map(imageId => 
      new Promise((resolve, reject) => {
        const request = store.get(imageId);
        
        request.onsuccess = () => resolve({
          id: imageId,
          data: request.result?.data || null
        });
        
        request.onerror = () => reject(request.error);
      })
    );
    
    return Promise.all(promises);
  };

  // 單個圖片獲取 (兼容舊API)
  const getImage = async (imageId) => {
    try {
      const results = await getImagesBatch([imageId]);
      return results[0]?.data || null;
    } catch (error) {
      console.error('Error getting image:', error);
      return null;
    }
  };

  // 批量刪除圖片
  const deleteImagesBatch = async (imageIds) => {
    if (!dbInstance || dbInstance.closed) {
      await initDB();
    }
    
    // 更新最後使用時間
    if (dbInstance) {
      dbInstance.lastUsed = Date.now();
    }
    
    const db = dbInstance.connection;
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    
    const promises = imageIds.map(imageId => 
      new Promise((resolve, reject) => {
        const request = store.delete(imageId);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      })
    );
    
    return Promise.all(promises);
  };

  // 單個圖片刪除 (兼容舊API)
  const deleteImage = async (imageId) => {
    try {
      const results = await deleteImagesBatch([imageId]);
      return results[0];
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  };

  return (
    <ListContext.Provider 
      value={{ 
        savedLists, 
        setSavedLists: updateSavedLists,
        saveImage,
        saveImagesBatch,
        getImage,
        getImagesBatch,
        deleteImage,
        deleteImagesBatch,
        isLoading 
      }}
    >
      {children}
    </ListContext.Provider>
  );
};

// Custom Hook 用於使用 Context
export const useList = () => {
  const context = useContext(ListContext);
  if (!context) {
    throw new Error('useList must be used within a ListProvider');
  }
  return context;
};