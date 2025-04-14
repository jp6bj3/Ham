// loadCategories.js

// 建立重試機制的工具函數
const retry = async (fn, retries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`重試第 ${i + 1} 次...`);
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

// 驗證 Airtable 響應數據
const validateAirtableResponse = (data) => {
  if (!data || !Array.isArray(data.records)) {
    throw new Error('無效的 Airtable 響應格式');
  }
  
  return data; // 移除空記錄檢查，因為我們現在聚合所有頁面的數據
};

// 解析類別數據
const parseCategoryData = (records) => {
  const uniqueCategories = new Set();
  let hasValidCategory = false;

  records.forEach(record => {
    const category = record.fields['品項'];
    if (category) {
      hasValidCategory = true;
      // 處理不同類型的類別數據
      if (Array.isArray(category)) {
        category.forEach(item => {
          if (item && typeof item === 'string') {
            item.split(/[,;，；]\s*/).forEach(v => {
              const trimmed = v.trim();
              if (trimmed) {
                uniqueCategories.add(trimmed);
              }
            });
          }
        });
      } else {
        const values = category.toString().split(/[,;，；]\s*/);
        values.forEach(v => {
          const trimmed = v.trim();
          if (trimmed) {
            uniqueCategories.add(trimmed);
          }
        });
      }
    }
  });

  if (!hasValidCategory) {
    throw new Error('未找到有效的類別數據');
  }

  return Array.from(uniqueCategories);
};

// 主要的類別載入函數
const loadCategories = async (envConfig) => {
  if (!envConfig?.REACT_APP_AIRTABLE_API_KEY || !envConfig?.REACT_APP_AIRTABLE_BASE_ID) {
    throw new Error('環境配置無效');
  }

  const fetchCategories = async () => {
    console.log('開始載入類別數據...');
    
    // 存储所有页面的记录
    let allRecords = [];
    let offset = null;
    let pageCount = 0;
    
    do {
      pageCount++;
      console.log(`加載類別數據：第 ${pageCount} 頁...`);
      
      // 构建 URL，添加分页参数
      let url = `https://api.airtable.com/v0/${envConfig.REACT_APP_AIRTABLE_BASE_ID}/design`;
      const params = new URLSearchParams();
      
      // 添加时间戳防止缓存
      params.append('_', Date.now());
      
      // 每页获取最大记录数
      params.append('pageSize', '100');
      
      // 添加偏移量获取下一页
      if (offset) {
        params.append('offset', offset);
      }
      
      const requestUrl = `${url}?${params.toString()}`;
      
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${envConfig.REACT_APP_AIRTABLE_API_KEY}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '未知錯誤');
        console.error('API 響應錯誤:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`API 請求失敗 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // 验证响应格式
      const validatedData = validateAirtableResponse(data);
      
      // 添加当前页记录到总记录集
      if (validatedData.records && validatedData.records.length > 0) {
        allRecords = [...allRecords, ...validatedData.records];
        console.log(`已獲取 ${allRecords.length} 條記錄`);
      }
      
      // 更新偏移量，如果存在则继续获取下一页
      offset = validatedData.offset || null;
      
    } while (offset); // 当有偏移量时继续循环
    
    console.log(`類別數據加載完成：共 ${pageCount} 頁，${allRecords.length} 條記錄`);
    
    // 如果没有记录，抛出错误
    if (allRecords.length === 0) {
      throw new Error('未找到任何記錄');
    }
    
    // 解析所有记录的类别
    const categories = parseCategoryData(allRecords);
    
    if (categories.length === 0) {
      throw new Error('處理後未得到有效類別');
    }

    console.log(`成功解析 ${categories.length} 個類別`);
    return categories;
  };

  try {
    return await retry(fetchCategories);
  } catch (error) {
    console.error('載入類別失敗:', error);
    
    // 根據錯誤類型提供具體信息
    if (error.message.includes('API 請求失敗')) {
      if (error.message.includes('401')) {
        throw new Error('存取權限驗證失敗，請檢查 API 金鑰設定');
      } else if (error.message.includes('403')) {
        throw new Error('沒有存取權限，請確認 API 金鑰權限設定');
      } else if (error.message.includes('429')) {
        throw new Error('請求次數過多，請稍後再試');
      } else {
        throw new Error('連接到數據服務失敗，請檢查網路連接後重試');
      }
    } else if (error.message.includes('未找到')) {
      throw new Error('系統當前無法讀取類別資料，請聯繫管理員');
    } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('網路連接失敗，請確認網路狀態後重試');
    } else {
      throw new Error('載入類別時發生錯誤，請重新整理頁面');
    }
  }
};

export default loadCategories;