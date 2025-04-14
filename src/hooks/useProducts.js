// hooks/useProducts.js
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useProducts = (
  config, 
  currentCategory, 
  currentFilters, 
  searchTerm,
  currentPage,
  pageSize,
  setTotalPages
) => {
  const queryClient = useQueryClient();
  
  // 使用不包含頁碼的查詢鍵，這樣切換頁面時不會重新獲取數據
  const queryKey = ['products', currentCategory, currentFilters, searchTerm];

  return useQuery({
    enabled: !!config?.REACT_APP_AIRTABLE_API_KEY && !!config?.REACT_APP_AIRTABLE_BASE_ID,
    queryKey,
    
    queryFn: async ({ signal }) => {
      if (!config?.REACT_APP_AIRTABLE_API_KEY || !config?.REACT_APP_AIRTABLE_BASE_ID) {
        throw new Error('Configuration is not ready');
      }

      try {
        // 這裡我們只使用最基本的類別過濾，讓更複雜的篩選邏輯在前端執行
        // 這樣可以確保與 FilterSection.jsx 中的篩選邏輯一致
        const filterFormulas = [];
        
        if (currentCategory) {
          filterFormulas.push(`FIND("${currentCategory}", {品項})`);
        }
        
        // 不在API端添加搜索和過濾條件，而是獲取基本類別下的所有記錄
        // 然後在客戶端進行篩選

        const baseUrl = `https://api.airtable.com/v0/${config.REACT_APP_AIRTABLE_BASE_ID}/design`;
        let filterParam = '';
        
        if (filterFormulas.length > 0) {
          const formula = filterFormulas.join(',');
          const finalFormula = filterFormulas.length > 1 ? `AND(${formula})` : formula;
          filterParam = `filterByFormula=${encodeURIComponent(finalFormula)}`;
        }

        // 使用 requestId 來防止重複請求
        const requestId = Date.now().toString();
        queryClient.setQueryData(['requestId', ...queryKey], requestId);

        // 考慮到API最多返回100條記錄的限制，使用批處理策略
        // 首先檢查是否有緩存的結果
        const cacheKey = JSON.stringify(['products', currentCategory]); // 只緩存基於類別的數據
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          const cacheTimestamp = parsedData.timestamp;
          const now = Date.now();
          
          // 如果緩存時間不超過10分鐘，則使用緩存數據
          if (now - cacheTimestamp < 10 * 60 * 1000) {
            console.log('Using cached data');
            const allRecords = parsedData.allRecords;
            
            // 在客戶端應用搜索和過濾條件
            const filteredRecords = applyClientSideFilters(
              allRecords, 
              currentFilters,
              searchTerm
            );
            
            const totalRecords = filteredRecords.length;
            const calculatedTotalPages = Math.ceil(totalRecords / pageSize);
            setTotalPages(calculatedTotalPages);
            
            return {
              allRecords: filteredRecords,
              totalRecords,
              totalPages: calculatedTotalPages
            };
          }
        }

        // 實現批處理請求
        const batchSize = 3; // 一次併發請求的批次數量
        let allRecords = [];
        let nextOffset = null;
        
        do {
          // 檢查請求是否被取消
          if (signal?.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          
          // 確保請求未被新的請求取代
          const currentRequestId = queryClient.getQueryData(['requestId', ...queryKey]);
          if (currentRequestId !== requestId) {
            console.log('Request superseded by newer request');
            throw new DOMException('Request superseded', 'AbortError');
          }
          
          // 準備批次請求
          const batchRequests = [];
          let currentOffset = nextOffset;
          
          for (let i = 0; i < batchSize && (i === 0 || currentOffset); i++) {
            const queryParams = [];
            if (filterParam) {
              queryParams.push(filterParam);
            }
            queryParams.push('pageSize=100'); // API限制，最多100條
            
            if (currentOffset) {
              queryParams.push(`offset=${currentOffset}`);
            }
            
            const url = `${baseUrl}${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
            
            batchRequests.push(
              fetch(url, {
                headers: {
                  'Authorization': `Bearer ${config.REACT_APP_AIRTABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                signal
              }).then(response => {
                if (!response.ok) {
                  throw new Error(`API request failed: ${response.status}`);
                }
                return response.json();
              })
            );
            
            // 只在第一個請求時使用 null，後續的會在批次內遞增
            currentOffset = null;
          }
          
          // 併發執行批次請求
          console.log(`Executing batch request with ${batchRequests.length} requests`);
          const batchResults = await Promise.all(batchRequests);
          
          // 處理批次結果
          for (const data of batchResults) {
            allRecords = [...allRecords, ...data.records];
            // 更新 offset 為最後一個批次的 offset
            if (data.offset) {
              nextOffset = data.offset;
            } else {
              nextOffset = null;
            }
          }
          
          // 如果最後一個批次沒有 offset，說明已經獲取了所有數據
          if (!nextOffset) {
            break;
          }
          
          // 給用戶提供視覺反饋
          console.log(`Already fetched ${allRecords.length} records, continuing...`);
          
        } while (nextOffset);

        // 緩存原始數據到sessionStorage
        sessionStorage.setItem(cacheKey, JSON.stringify({
          allRecords,
          timestamp: Date.now()
        }));

        // 在客戶端應用搜索和過濾條件
        const filteredRecords = applyClientSideFilters(
          allRecords, 
          currentFilters,
          searchTerm
        );
        
        const totalRecords = filteredRecords.length;
        const calculatedTotalPages = Math.ceil(totalRecords / pageSize);
        setTotalPages(calculatedTotalPages);

        return {
          allRecords: filteredRecords,
          totalRecords,
          totalPages: calculatedTotalPages
        };

      } catch (error) {
        // 判斷是否是由於請求被取消而導致的錯誤
        if (error.name === 'AbortError') {
          console.log('Request was cancelled or superseded');
          throw error;
        }
        
        console.error('Error fetching products:', error);
        throw new Error('載入數據失敗，請重試');
      }
    },
    
    retry: (failureCount, error) => {
      // 如果是請求被取消或取代，則不重試
      if (error.name === 'AbortError') return false;
      // 否則根據失敗次數決定是否重試，最多重試2次
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // 優化緩存策略
    staleTime: 1000 * 60 * 10,  // 10分鐘內不重新獲取，提高緩存時效
    refetchOnWindowFocus: true, // 当用户重新返回页面时刷新
    refetchOnMount: true,       // 组件重新挂载时刷新
    refetchOnReconnect: true,   // 网络重连时刷新

    onError: (error) => {
      // 只有在非取消請求的情況下才顯示錯誤
      if (error.name !== 'AbortError') {
        console.error('Query error:', error);
      }
    }
  });
};

// 實現與 FilterSection.jsx 一致的客戶端篩選邏輯
function applyClientSideFilters(records, filters, searchTerm) {
  return records.filter(record => {
    // 搜索條件檢查
    if (searchTerm && searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase().trim();
      const searchFields = ['美工圖編號', '美工圖名稱', '設計者1', '產品特色1'];
      const matchesSearch = searchFields.some(field => {
        const value = record.fields[field];
        return value && String(value).toLowerCase().includes(searchTermLower);
      });
      
      if (!matchesSearch) return false;
    }
    
    // 篩選條件檢查 - 應用與 FilterSection.jsx 一致的邏輯
    return Object.entries(filters).every(([field, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) return true;
      
      // 獲取所有匹配的欄位(包含數字後綴)
      const matchingFields = Object.keys(record.fields)
        .filter(key => key.replace(/\d+$/, '') === field);
      
      if (matchingFields.length === 0) return false;
      
      // 檢查是否有任一選中值匹配任一欄位值 (OR 邏輯)
      return selectedValues.some(selected => {
        return matchingFields.some(fieldKey => {
          const fieldValue = record.fields[fieldKey];
          if (!fieldValue) return false;
          
          // 處理數組
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(item => 
              String(item).toLowerCase().includes(selected.toLowerCase())
            );
          }
          
          // 處理字符串，按逗號或分號分割
          if (typeof fieldValue === 'string') {
            return fieldValue.split(/[,;，；]\s*/)
              .some(item => item.trim().toLowerCase().includes(selected.toLowerCase()));
          }
          
          // 處理其他類型
          return String(fieldValue).toLowerCase().includes(selected.toLowerCase());
        });
      });
    });
  });
}