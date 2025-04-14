import React, { useState, useEffect, useRef, useCallback } from 'react';

const FilterDropdown = ({ 
  label, 
  options, 
  value, 
  onChange, 
  searchable = true,
  availableOptions,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const hasSelectedValues = value && value.length > 0;

  // 使用 useCallback 創建穩定的事件處理函數
  const handleClickOutside = useCallback((event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  }, []);

  // 處理動畫狀態
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 200); // 配合 duration-200
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 只保留一個事件監聽器
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);
  
  const handleReset = (e) => {
    e.stopPropagation(); // 防止觸發開關
    onChange([]); // 清空當前設置
    setSearchTerm(''); // 同时清空搜索词
  };
  
  // 過濾選項時同時考慮搜索詞和可用選項
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!availableOptions || availableOptions.includes(option))
  ).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  // 計算每個選項可選擇的數量
  const getOptionCount = (option) => {
    if (!availableOptions) return null;
    return availableOptions.filter(o => o === option).length;
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={[
          'w-full px-3 py-2 text-left border rounded flex justify-between items-center',
          hasSelectedValues ? 'bg-blue-50 border-blue-200' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
        ].filter(Boolean).join(' ')}
      >
        <div className="flex flex-col gap-1">
          <span>{label}</span>
          {hasSelectedValues && (
            <span className="text-sm text-blue-600">
              已選: {value.length}
            </span>
          )}
        </div>
        <span className="ml-2">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {(isOpen || isAnimating) && !disabled && (
        <div 
          className={`
            absolute z-50 w-full mt-1 bg-white border rounded shadow-lg
            transition-all duration-200 ease-in-out
            ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}
            origin-top
          `}
        >
          {searchable && (
            <div className="p-2 border-b flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋..."
                className="flex-1 px-2 py-1 border rounded"
                onClick={(e) => e.stopPropagation()}
              />
              {(hasSelectedValues || searchTerm) && (
                <button
                  onClick={handleReset}
                  className="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150"
                >
                  重置
                </button>
              )}
            </div>
          )}
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option) => {
              const count = getOptionCount(option);
              return (
                <label
                  key={option}
                  className={[
                    'flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors duration-150',
                    count === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  ].filter(Boolean).join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option)}
                    onChange={(e) => {
                      if (count !== 0) {
                        const newValue = e.target.checked
                          ? [...value, option]
                          : value.filter(v => v !== option);
                        onChange(newValue);
                      }
                    }}
                    className="mr-2"
                    disabled={count === 0}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterSection = ({ currentCategory, setCurrentFilters, apiKey, baseId, tableName, searchTerm }) => {
  const [filterValues, setFilterValues] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [availableOptions, setAvailableOptions] = useState({});
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [resultCount, setResultCount] = useState(0);
  const [selectedFieldsOrder, setSelectedFieldsOrder] = useState([]);

  // 處理滾動時自動收合篩選器
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = Math.abs(currentScrollY - lastScrollY); // 使用絕對值來判斷滾動幅度
      const viewportHeight = window.innerHeight;
      const scrollThreshold = viewportHeight * 0.02; // 2vh
      
      // 只在向下滾動超過 2vh 且目前是展開狀態時收合
      if (scrollDiff > scrollThreshold && isExpanded) {
        setIsExpanded(false);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isExpanded]);

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded);
  };

  // 加載數據並保存原始記錄
 // 修改 loadFilterOptions 函数实现分页加载所有数据
const loadFilterOptions = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    const encodedFormula = encodeURIComponent(`FIND("${currentCategory}", {品項})`);
    
    
    // 存储所有记录
    let allRecords = [];
    let offset = null;
    
    // 循环获取所有页面的数据
    do {
      // 构建 URL
      let url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula=${encodedFormula}&_=${timestamp}`;
      if (offset) {
        url += `&offset=${offset}`;
      }
            
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch filter options: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 添加当前页记录
      if (data.records && data.records.length > 0) {
        allRecords = [...allRecords, ...data.records];
      }
      
      // 更新偏移量继续获取下一页
      offset = data.offset || null;
      
    } while (offset); // 当有偏移量时继续循环
    
    if (allRecords.length === 0) {
      setFilterOptions({});
      setAvailableOptions({});
      setRecords([]);
      setResultCount(0);
      setIsLoading(false);
      return;
    }

    // 篩選真正包含當前類別的記錄 - 优化匹配逻辑
    const relevantRecords = allRecords.filter(record => {
      if (!record.fields || !record.fields['品項']) return false;
      
      const categoryField = record.fields['品項'];
      
      // 优化匹配逻辑处理各种情况
      if (Array.isArray(categoryField)) {
        return categoryField.some(item => 
          item === currentCategory || 
          item.includes(currentCategory) ||
          currentCategory.includes(item)
        );
      } else if (typeof categoryField === 'string') {
        // 分割字符串并检查每个部分
        const parts = categoryField.split(/[,;，；]\s*/);
        if (parts.length > 1) {
          return parts.some(part => 
            part.trim() === currentCategory || 
            part.trim().includes(currentCategory) ||
            currentCategory.includes(part.trim())
          );
        }
        
        return categoryField === currentCategory || 
               categoryField.includes(currentCategory) ||
               currentCategory.includes(categoryField);
      }
      
      return false;
    });
    

    
    setRecords(relevantRecords);

    // 用於存儲所有可能的欄位名稱
    const allFields = new Set();
    const optionsMap = {};
    
    // 统计所有字段出现次数以便调试
    const allKeysCount = {};

    // 首先收集所有可能的欄位名稱
    relevantRecords.forEach(record => {
      if (record.fields) {
        Object.keys(record.fields).forEach(key => {
          // 移除數字後綴
          const baseFieldName = key.replace(/\d+$/, '');
          // 记录字段出现次数
          allKeysCount[baseFieldName] = (allKeysCount[baseFieldName] || 0) + 1;
          
          // 排除特定欄位
          const excludedFields = [
            '品項', '圖檔', '美工圖編號', '美工圖名稱',
            '流水號(方便複製資料用)', '進度', '備註', '最新版本', '立案日', 'Collaborator','射出次數','斜直孔','目標市場','下次提案日期'
          ];
          if (!excludedFields.includes(baseFieldName)) {
            allFields.add(baseFieldName);
          }
        });
      }
    });


    // 初始化每個欄位的 Set
    allFields.forEach(field => {
      optionsMap[field] = new Set();
    });

    // 收集每個欄位的選項
    let processedValueCount = 0;
    
    relevantRecords.forEach(record => {
      if (record.fields) {
        Object.entries(record.fields).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const baseFieldName = key.replace(/\d+$/, '');
            // 確保排除的欄位與上面一致
            const excludedFields = [
              '品項', '圖檔', '美工圖編號', '美工圖名稱',
            '流水號(方便複製資料用)', '進度', '備註', '最新版本', '立案日', 'Collaborator','射出次數','斜直孔','目標市場','下次提案日期'
            ];
            if (optionsMap.hasOwnProperty(baseFieldName) && !excludedFields.includes(baseFieldName)) {
              processedValueCount++;
              
              // 處理不同類型的數據
              if (Array.isArray(value)) {
                // 如果是陣列，直接加入每個項目
                value.forEach(item => {
                  if (typeof item === 'string' && !item.startsWith('rec') && item.trim()) {
                    optionsMap[baseFieldName].add(item.trim());
                  }
                });
              } else {
                // 如果是字串，分割後加入
                const valueStr = value.toString();
                const values = valueStr.split(/[,;，；]\s*/);
                values.forEach(v => {
                  if (!v.startsWith('rec') && v.trim()) {
                    optionsMap[baseFieldName].add(v.trim());
                  }
                });
              }
            }
          }
        });
      }
    });
    
    // 將 Set 轉換為排序後的數組
    const finalOptions = {};
    Object.keys(optionsMap).forEach(key => {
      const sortedArray = Array.from(optionsMap[key]).sort((a, b) => 
        a.localeCompare(b, 'zh-Hant')
      );
      if (sortedArray.length > 0) {
        finalOptions[key] = sortedArray;
      }
    });
  
    setFilterOptions(finalOptions);
    updateAvailableOptions({}, relevantRecords);
    setResultCount(relevantRecords.length);
  } catch (error) {
    console.error('載入篩選選項失敗:', error);
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
}, [apiKey, baseId, currentCategory, tableName]);

  // 更新可用選項，整合搜尋功能 - 改進的篩選邏輯
  const updateAvailableOptions = useCallback((currentFilters, currentRecords, currentSearchTerm = '') => {
    // 應用改進的篩選邏輯
    const filteredRecords = currentRecords.filter(record => {
      // 搜索條件檢查
      if (currentSearchTerm) {
        const searchFields = ['美工圖編號', '美工圖名稱', '產品特色1'];
        const matchesSearch = searchFields.some(field => {
          const value = record.fields[field];
          return value && value.toString().toLowerCase().includes(currentSearchTerm.toLowerCase());
        });
        if (!matchesSearch) return false;
      }

      // 篩選條件檢查 - 改進的邏輯
      return Object.entries(currentFilters).every(([field, selectedValues]) => {
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

    // 更新可用選項
    const newAvailableOptions = {};
    Object.keys(filterOptions).forEach(field => {
      // 檢查是否是當前展示全部選項的字段（順序中的第一個）
      if (selectedFieldsOrder.length > 0 && field === selectedFieldsOrder[0]) {
        newAvailableOptions[field] = filterOptions[field];
      } else {
        // 其他字段進行交叉過濾
        const availableValues = new Set();
        filteredRecords.forEach(record => {
          Object.entries(record.fields)
            .filter(([key]) => key.replace(/\d+$/, '') === field)
            .forEach(([_, value]) => {
              if (value) {
                if (Array.isArray(value)) {
                  value.forEach(v => {
                    if (typeof v === 'string' && !v.startsWith('rec') && v.trim()) {
                      availableValues.add(v.trim());
                    }
                  });
                } else {
                  String(value).split(/[,;，；]\s*/).forEach(v => {
                    if (!v.startsWith('rec') && v.trim()) {
                      availableValues.add(v.trim());
                    }
                  });
                }
              }
            });
        });
        newAvailableOptions[field] = Array.from(availableValues);
      }
    });

    setAvailableOptions(newAvailableOptions);
    setResultCount(filteredRecords.length);
  }, [filterOptions, selectedFieldsOrder]);

  // 監聽搜尋詞變化
  useEffect(() => {
    updateAvailableOptions(filterValues, records, searchTerm);
  }, [searchTerm, filterValues, records, updateAvailableOptions]);

  // 重置篩選器
  const resetFilters = useCallback(() => {
    setFilterValues({});
    setCurrentFilters({});
    setSelectedFieldsOrder([]); // 清空選擇順序
    updateAvailableOptions({}, records);
  }, [setCurrentFilters, records, updateAvailableOptions]);

  // 處理篩選變更
  const handleFilterChange = (key, values) => {
    const newFilterValues = {
      ...filterValues,
      [key]: values
    };

    // 更新選擇順序
    if (values.length > 0 && !filterValues[key]?.length) {
      // 如果是新選擇的字段，加入到順序末尾
      setSelectedFieldsOrder(prev => [...prev.filter(field => field !== key), key]);
    } else if (values.length === 0 && filterValues[key]?.length > 0) {
      // 如果是取消選擇，從順序中移除
      setSelectedFieldsOrder(prev => prev.filter(field => field !== key));
    }

    setFilterValues(newFilterValues);
    setCurrentFilters(newFilterValues);
    updateAvailableOptions(newFilterValues, records, searchTerm);
  };

  useEffect(() => {
    // 當類別改變時，重置所有篩選值
    setFilterValues({});
    setCurrentFilters({});
    loadFilterOptions();
  }, [currentCategory, loadFilterOptions, setCurrentFilters]);
     
  if (isLoading) {
    return <div className="p-2">載入篩選選項中...</div>;
  }

  if (error) {
    return (
      <div className="p-2 text-red-500">
        載入篩選選項失敗
      </div>
    );
  }

  const filterOrder = [
    '設計年份',
    '產品狀態',
    '類別',
    '設計者',
    '產品特色',
    '目標客戶',
    '孔數',
    '純量孔_有斜孔',
    '射出'
  ];

  const orderedFilters = filterOrder
    .filter(key => filterOptions.hasOwnProperty(key))
    .map(key => [key, filterOptions[key]]);

  // 添加未在順序中但存在的篩選器
  Object.entries(filterOptions)
    .filter(([key]) => !filterOrder.includes(key))
    .forEach(entry => orderedFilters.push(entry));

  const hasActiveFilters = Object.values(filterValues).some(
    values => values && values.length > 0
  );

  const activeFiltersSummary = Object.entries(filterValues)
    .filter(([_, values]) => values && values.length > 0)
    .map(([key, values]) => ({
      label: key,
      values: values
    }));

  return (
    <div className="sticky top-0 bg-white z-30 transition-all duration-300">
      {!isExpanded && (
        <div className="p-2 border-b flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ▼ 展開篩選
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded hover:bg-red-50"
              >
                清除全部
              </button>
            )}
          </div>
          
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {activeFiltersSummary.map(filter => (
                <div key={filter.label} className="bg-blue-50 px-2 py-1 rounded-full text-sm">
                  {filter.label}: {filter.values.join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {isExpanded && (
        <div className="p-2 border-b">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ▲ 收合篩選
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded hover:bg-red-50"
                >
                  清除全部
                </button>
              )}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {activeFiltersSummary.map(filter => (
                    <div key={filter.label} className="bg-blue-50 px-2 py-1 rounded-full text-sm">
                      {filter.label}: {filter.values.join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {resultCount === 0 && hasActiveFilters && (
            <div className="mb-2 p-2 bg-yellow-50 text-yellow-700 rounded">
              目前的篩選條件沒有符合的結果，請嘗試減少或更改篩選條件。
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2  text-sm">
            {orderedFilters.map(([key, options]) => (
              <FilterDropdown
                key={key}
                label={key}
                options={options}
                value={filterValues[key] || []}
                onChange={(values) => handleFilterChange(key, values)}
                availableOptions={availableOptions[key]}
                disabled={resultCount === 0 && !filterValues[key]?.length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSection;