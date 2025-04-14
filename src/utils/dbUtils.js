// dbUtils.js

// 數據庫連接池 - 單例模式
let dbInstances = {};

// 獲取數據庫連接
const getDBConnection = (dbName, version, upgradeCallback) => {
  // 如果已有連接且連接未關閉，直接返回
  if (dbInstances[dbName] && !dbInstances[dbName].closed) {
    return Promise.resolve(dbInstances[dbName].connection);
  }
  
  // 否則創建新連接
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const connection = request.result;
      
      // 監聽連接關閉事件
      connection.onclose = () => {
        dbInstances[dbName].closed = true;
      };
      
      // 儲存連接到連接池
      dbInstances[dbName] = {
        connection,
        closed: false,
        lastUsed: Date.now()
      };
      
      resolve(connection);
    };
    
    // 如果需要升級數據庫，執行回調
    if (upgradeCallback) {
      request.onupgradeneeded = (event) => {
        upgradeCallback(event.target.result);
      };
    }
  });
};

// 定期清理未使用的連接
const cleanupDBConnections = () => {
  const now = Date.now();
  const maxIdleTime = 60000; // 60 秒未使用則關閉
  
  Object.entries(dbInstances).forEach(([dbName, instance]) => {
    if (!instance.closed && (now - instance.lastUsed > maxIdleTime)) {
      instance.connection.close();
      instance.closed = true;
      console.log(`關閉閒置的數據庫連接: ${dbName}`);
    }
  });
};

// 每分鐘檢查一次閒置連接
setInterval(cleanupDBConnections, 60000);

// ColorPickerDB 的升級回調
const colorDBUpgradeCallback = (db) => {
  if (db.objectStoreNames.contains('colors')) {
    db.deleteObjectStore('colors');
  }
  
  const store = db.createObjectStore('colors', { 
    keyPath: 'id', 
    autoIncrement: true 
  });
  
  store.createIndex('by_product_variant', ['listName', 'productId', 'variantIndex'], { unique: false });
  console.log('Database upgrade completed');
};

// 獲取 ColorPickerDB 連接
export const getColorDB = () => {
  return getDBConnection('ColorPickerDB', 4, colorDBUpgradeCallback);
};

// 批量保存顏色
export const saveColorsToDB = async (colors, listName, productId, variantIndex) => {
  try {
    const db = await getColorDB();
    const tx = db.transaction('colors', 'readwrite');
    const store = tx.objectStore('colors');
    const index = store.index('by_product_variant');
    
    // 獲取現有顏色
    const existingColors = await new Promise((resolve, reject) => {
      const request = index.getAll([listName, productId, variantIndex]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 過濾出不重複的顏色
    const uniqueColors = colors.filter(color => 
      !existingColors.some(existing => 
        existing.hue === color.hue && 
        existing.saturation === color.saturation && 
        existing.lightness === color.lightness
      )
    );
    
    // 批量添加
    const promises = uniqueColors.map(color => 
      new Promise((resolve, reject) => {
        const request = store.add({
          ...color,
          listName,
          productId,
          variantIndex,
          timestamp: new Date().toISOString()
        });
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      })
    );
    
    // 更新最後使用時間
    dbInstances['ColorPickerDB'].lastUsed = Date.now();
    
    return Promise.all(promises).then(results => results.some(result => result));
  } catch (error) {
    console.error('Error saving colors:', error);
    return false;
  }
};

// 單一顏色保存 (兼容舊API)
export const saveColorToDB = async (color, listName, productId, variantIndex) => {
  return saveColorsToDB([color], listName, productId, variantIndex);
};

// 批量刪除顏色
export const deleteColorsFromDB = async (colorIds) => {
  try {
    const db = await getColorDB();
    const tx = db.transaction('colors', 'readwrite');
    const store = tx.objectStore('colors');
    
    const promises = colorIds.map(id => 
      new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      })
    );
    
    // 更新最後使用時間
    dbInstances['ColorPickerDB'].lastUsed = Date.now();
    
    return Promise.all(promises).then(results => results.every(result => result));
  } catch (error) {
    console.error('Error deleting colors:', error);
    return false;
  }
};

// 單一顏色刪除 (兼容舊API)
export const deleteColorFromDB = async (colorId) => {
  return deleteColorsFromDB([colorId]);
};

// 加載顏色
export const loadColorsFromDB = async (listName, productId, variantIndex) => {
  try {
    const db = await getColorDB();
    const tx = db.transaction('colors', 'readonly');
    const store = tx.objectStore('colors');
    const index = store.index('by_product_variant');
    
    const result = await new Promise((resolve, reject) => {
      const request = index.getAll([listName, productId, variantIndex]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 更新最後使用時間
    dbInstances['ColorPickerDB'].lastUsed = Date.now();
    
    return result;
  } catch (error) {
    console.error('Error loading colors:', error);
    return [];
  }
};

// 變體刪除時跟著刪除色票
export const deleteColorsByVariant = async (listName, productId, variantIndex) => {
  try {
    const db = await getColorDB();
    const tx = db.transaction('colors', 'readwrite');
    const store = tx.objectStore('colors');
    const index = store.index('by_product_variant');
    
    // 獲取所有匹配的顏色
    const colors = await new Promise((resolve, reject) => {
      const request = index.getAll([listName, productId, variantIndex]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 批量刪除
    const colorIds = colors.map(color => color.id);
    const result = await deleteColorsFromDB(colorIds);
    
    // 更新最後使用時間
    dbInstances['ColorPickerDB'].lastUsed = Date.now();
    
    return result;
  } catch (error) {
    console.error('Error deleting colors by variant:', error);
    return false;
  }
};

// 更新色票索引
export const updateColorVariantIndices = async (listName, productId, startIndex) => {
  try {
    const db = await getColorDB();
    const tx = db.transaction('colors', 'readwrite');
    const store = tx.objectStore('colors');
    const index = store.index('by_product_variant');
    
    // 獲取所有大於等於 startIndex 的色票
    const range = IDBKeyRange.bound(
      [listName, productId, startIndex],
      [listName, productId, Infinity]
    );
    
    const colors = await new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 批量更新
    const updatePromises = colors.map(color => 
      new Promise((resolve, reject) => {
        const updateRequest = store.put({
          ...color,
          variantIndex: color.variantIndex - 1
        });
        updateRequest.onsuccess = () => resolve(true);
        updateRequest.onerror = () => reject(updateRequest.error);
      })
    );
    
    // 更新最後使用時間
    dbInstances['ColorPickerDB'].lastUsed = Date.now();
    
    return Promise.all(updatePromises).then(results => results.every(result => result));
  } catch (error) {
    console.error('Error updating color indices:', error);
    return false;
  }
};