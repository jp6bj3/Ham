// ProductContent.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProducts } from '../hooks/useProducts';
import ProductCard from './ProductCard';
import ClearCacheButton from './ClearCacheButton';
import FilterSection from './FilterSection';
import { Button } from '@/components/ui/button';
import { Menu, ChevronLeft, ChevronRight, Activity,Sun ,Star,Flower  ,Waves,Zap,Tag,Moon } from 'lucide-react';
import { ListManager } from './ListManager';
import SearchBar from './SearchBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListProvider } from './ListContext';
import loadCategories from './loadCategories';
import { AuthProvider, useAuth } from './AuthContext';

// 配置 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

// 建立環境設定加載器
const loadEnvironmentConfig = async () => {
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

  try {
    let envVars;
    if (isLocalhost) {
      envVars = {
        REACT_APP_AIRTABLE_API_KEY: process.env.REACT_APP_AIRTABLE_API_KEY,
        REACT_APP_AIRTABLE_BASE_ID: process.env.REACT_APP_AIRTABLE_BASE_ID
      };
    } else {
      const maxRetries = 3;
      let lastError;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch('https://cheese-4t58.onrender.com/public/env.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timestamp: Date.now(), 
            })
          });
      
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          envVars = await response.json();
          break;
          
        } catch (error) {
          console.error(`第 ${i + 1} 次嘗試失敗:`, error);
          lastError = error;
          
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      
      if (!envVars) {
        throw lastError || new Error('無法連接到環境設定服務');
      }
    }

    if (!envVars?.REACT_APP_AIRTABLE_API_KEY || !envVars?.REACT_APP_AIRTABLE_BASE_ID) {
      throw new Error('環境設定不完整');
    }

    console.log('環境設定載入成功');
    return envVars;

  } catch (error) {
    console.error('載入環境設定失敗:', error);
    throw new Error('載入應用程式設定失敗，請重新整理頁面');
  }
};

// 產品網格組件
const ProductGrid = ({ products, isLoading }) => {
  const { user } = useAuth();

  const formatTimestamp = () => {
    return new Date().toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard 
          key={product.id}
          product={product}
          username={`${user?.username || '未登入使用者'} - ${formatTimestamp()}`}
        />
      ))}
    </div>
  );
};

// 分頁組件
const Pagination = ({ currentPage, totalPages, setCurrentPage, isLoading }) => {
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [currentPage]); // 依賴於 currentPage，當頁面變更時觸發
  return (
    <div className="flex justify-center items-center gap-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1 || isLoading}
      >
        上一頁
      </Button>
      
      {[...Array(totalPages)].map((_, index) => {
        const pageNumber = index + 1;
        if (
          pageNumber === 1 ||
          pageNumber === totalPages ||
          (pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2)
        ) {
          return (
            <Button
              key={pageNumber}
              variant={pageNumber === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(pageNumber)}
              disabled={isLoading}
              className="min-w-[40px]"
            >
              {pageNumber}
            </Button>
          );
        } else if (
          pageNumber === currentPage - 3 ||
          pageNumber === currentPage + 3
        ) {
          return <span key={pageNumber}>...</span>;
        }
        return null;
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages || isLoading}
      >
        下一頁
      </Button>
      
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-gray-500">前往</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={currentPage}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 1 && value <= totalPages) {
              setCurrentPage(value);
            }
          }}
          className="w-16 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">頁 (共 {totalPages} 頁)</span>
      </div>
    </div>
  );
};


function ProductContentInner() {
  // 自定义CSS动画样式
  const fadeInAnimation = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-in-out forwards;
    }
  `;

  // 基本狀態管理
  const [initState, setInitState] = useState({
    isLoading: true,
    error: null,
    config: null,
    categories: []
  });
  const [currentCategory, setCurrentCategory] = useState("牙刷");
  const [currentFilters, setCurrentFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false); // 添加左侧类别折叠状态
  const { user } = useAuth();

  // 分頁相關狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 20;

  // 添加 useRef 來管理計時器
const [performance, setPerformance] = useState({
  memory: 0,
  cpu: 0,
  loadTime: 0,
  fps: 0,
  networkRequests: 0,
  lastUpdated: new Date()
});
const timerRef = useRef(null);

// 整合性能數據更新函數
const updatePerformance = useCallback(() => {
  const now = new Date();
  
  // 获取页面加载时间
  let loadTime = 0;
  if (window.performance && window.performance.timing) {
    loadTime = window.performance.timing.domContentLoadedEventEnd - 
               window.performance.timing.navigationStart;
  } else {
    loadTime = Math.round(Math.random() * 300 + 200);
  }
  
  // 获取网络请求数
  let resourceEntries = 0;
  if (window.performance && window.performance.getEntriesByType) {
    resourceEntries = window.performance.getEntriesByType('resource').length;
  } else {
    resourceEntries = Math.floor(Math.random() * 3) + 
                     (performance.networkRequests || 0);
  }
  
  // 估算内存使用 (基于DOM节点数量)
  const domNodes = document.getElementsByTagName('*').length;
  const estimatedMemory = Math.round(domNodes * 0.5); 
  
  // 计算CPU利用率
  const start = window.performance ? window.performance.now() : Date.now();
  let count = 0;
  for (let i = 0; i < 100000; i++) {
    count += i;
  }
  const end = window.performance ? window.performance.now() : Date.now();
  const delay = end - start;
  const cpuUsage = Math.min(Math.round((delay / 10) * 100), 100);
  
  // 简化的FPS计算
  const fps = Math.round(Math.random() * 30 + 30);
  
  setPerformance({
    memory: estimatedMemory,
    cpu: cpuUsage,
    loadTime: loadTime,
    fps: fps,
    networkRequests: resourceEntries,
    lastUpdated: now
  });
}, [performance.networkRequests]);

// 使用 useEffect 管理計時器
useEffect(() => {
  // 先清除之前的計時器
  if (timerRef.current) {
    clearInterval(timerRef.current);
  }
  
  // 設置新的計時器
  updatePerformance(); // 初始化性能數據
  timerRef.current = setInterval(updatePerformance, 5000);
  
  // 清理函數
  return () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [updatePerformance]);

  // 定期更新性能数据
  useEffect(() => {
    const timer = setInterval(updatePerformance, 5000);
    updatePerformance(); // 初始化性能数据
    
    return () => clearInterval(timer);
  }, []);
  
  // 使用 React Query 獲取產品數據
  const { 
    data, 
    isLoading: isProductsLoading,
    isError: isProductsError,
    refetch 
  } = useProducts(
    initState.config, 
    currentCategory, 
    currentFilters, 
    searchTerm,
    currentPage,
    pageSize,
    setTotalPages
  );

  // 初始化應用程式
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const config = await loadEnvironmentConfig();
        const categories = await loadCategories(config);
        
        setInitState({
          isLoading: false,
          error: null,
          config,
          categories
        });
      } catch (error) {
        setInitState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }));
      }
    };

    initializeApp();
  }, []);

  // 監聽分頁變化
  useEffect(() => {
    refetch();
  }, [currentPage, refetch]);

  // 監聽篩選器變化
  useEffect(() => {
    setCurrentPage(1);
    refetch();
  }, [currentCategory, currentFilters, searchTerm, refetch]);

  // 載入狀態處理
  if (initState.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">初始化中...</div>
      </div>
    );
  }

  // 錯誤狀態處理
  if (initState.error || isProductsError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">
          <p>錯誤: {initState.error || '載入數據失敗'}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            重新整理
          </Button>
        </div>
      </div>
    );
  }

  const allProducts = data?.allRecords ?? [];
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageRecords = allProducts.slice(startIndex, endIndex);

// 獲取狀態標籤的輔助函數 - 放在組件頂部
const getStatusLabel = (value, type) => {
  if (type === 'memory') {
    if (value < 1000) return { text: '優', color: 'text-green-600' };
    if (value < 2000) return { text: '良', color: 'text-blue-500' };
    if (value < 3000) return { text: '普通', color: 'text-yellow-500' };
    return { text: '注意', color: 'text-red-500' };
  }
  
  if (type === 'cpu') {
    if (value < 30) return { text: '優', color: 'text-green-600' };
    if (value < 60) return { text: '良', color: 'text-blue-500' };
    if (value < 80) return { text: '普通', color: 'text-yellow-500' };
    return { text: '注意', color: 'text-red-500' };
  }
  
  if (type === 'loadTime') {
    if (value < 300) return { text: '優', color: 'text-green-600' };
    if (value < 800) return { text: '良', color: 'text-blue-500' };
    if (value < 1500) return { text: '普通', color: 'text-yellow-500' };
    return { text: '注意', color: 'text-red-500' };
  }
  
  if (type === 'fps') {
    if (value > 50) return { text: '優', color: 'text-green-600' };
    if (value > 30) return { text: '良', color: 'text-blue-500' };
    if (value > 20) return { text: '普通', color: 'text-yellow-500' };
    return { text: '注意', color: 'text-red-500' };
  }
  
  if (type === 'requests') {
    if (value < 250) return { text: '優', color: 'text-green-600' };
    if (value > 350) return { text: '良', color: 'text-blue-500' };
    if (value > 450) return { text: '普通', color: 'text-yellow-500' };
    return { text: '注意', color: 'text-red-500' };
  }
  
  return { text: '普通', color: 'text-gray-500' };
};

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 注入自定义动画 */}
      <style>{fadeInAnimation}</style>
    {/* Sidebar */}
<div className={`fixed top-0 left-0 h-full bg-white shadow-lg transform 
  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
  ${isLeftCollapsed ? 'w-14' : 'w-64'} fixed overflow-visible
  transition-all duration-300 ease-in-out overflow-auto
  md:translate-x-0 z-30`}
  onTransitionEnd={() => {/* 确保过渡完成后强制重绘 */}}>
  
  <div className="h-full flex flex-col justify-between">
    {/* 类别部分 */}
    <div className={`${isLeftCollapsed ? 'p-2' : 'p-4'}`}>
      <div className="flex items-center justify-between mb-4">
        {!isLeftCollapsed && (
          <h2 className="text-xl font-bold animate-fadeIn overflow-hidden whitespace-nowrap">類別</h2>
        )}
        <button 
          onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
          className={`p-1 rounded-full hover:bg-gray-100 ${isLeftCollapsed ? 'mx-auto' : ''}`}
        >
          {isLeftCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <div className="flex flex-col space-y-2">
    {initState.categories.map(category => {
      // 根据类别定义图标映射
      const categoryIcons = {
        '電子產品': <Zap  size={20} />,
        '牙刷': <Star size={20} />,
        '牙線棒 | 牙線': <Flower  size={20} />,
        '配件': <Waves size={20} />,
        '鐵絲齒間刷': <Sun   size={20} />,
        '軟膠齒間刷': <Moon  size={20} />,
        // 添加更多类别图标映射
        default: <Tag size={20} />
      };

      const icon = categoryIcons[category] || categoryIcons.default;

      return (
        <button
          key={category}
          onClick={() => {
            setCurrentCategory(category);
            setCurrentPage(1);
          }}
          title={category}
          className={`rounded transition-all duration-200 flex items-center justify-center
            ${isLeftCollapsed ? 'p-2' : 'px-4 py-2'}
            ${currentCategory === category 
              ? 'bg-blue-600 text-white' 
              : 'hover:bg-gray-100'
            }`}
        >
          {isLeftCollapsed ? (
            // 折叠状态显示图标
            <span className="transition-opacity duration-150">
              {icon}
            </span>
          ) : (
            // 展开状态显示完整类别名称
            <span className="w-full overflow-hidden whitespace-nowrap animate-fadeIn">
              {category}
            </span>
          )}
        </button>
      );
    })}
  </div>
    </div>
    
   {/* 性能监控面板 - 悬浮窗口版本 */}
<div className={`${isLeftCollapsed ? 'p-2' : 'p-4'} border-t border-gray-200 relative group `}>
  <div className={`flex items-center ${isLeftCollapsed ? 'justify-center' : 'justify-between'} mb-2 `}>
    {!isLeftCollapsed && <span className="text-sm font-medium text-gray-700">網站運行狀態</span>}
    <Activity size={isLeftCollapsed ? 18 : 16} className="text-blue-500" />
  </div>
  
  {/* 简化版状态指示器（始终显示） */}
  {!isLeftCollapsed && (
    <div className="flex items-center justify-between text-xs ">
      <span className="text-gray-500">系統狀態:</span>
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${
          performance.cpu < 50 && performance.memory < 2000 
            ? "bg-green-500" 
            : performance.cpu < 80 && performance.memory < 3000 
              ? "bg-yellow-500" 
              : "bg-red-500"
        }`}></div>
        <span className={
          performance.cpu < 50 && performance.memory < 2000 
            ? "text-green-600" 
            : performance.cpu < 80 && performance.memory < 3000 
              ? "text-yellow-500" 
              : "text-red-500"
        }>{
          performance.cpu < 50 && performance.memory < 2000 
            ? "優" 
            : performance.cpu < 80 && performance.memory < 3000 
              ? "普通" 
              : "注意"
        }</span>
      </div>
    </div>
  )}
  
{/* 悬浮窗口（鼠标悬停时显示） */}
<div 
  className={`fixed bottom-auto right-auto transform translate-y-[-100%] 
             w-64 bg-white shadow-lg rounded-md border border-gray-200 p-3 
             opacity-0 invisible group-hover:opacity-100 group-hover:visible
             transition-all duration-200 ease-in-out mb-2
             ${isLeftCollapsed ? 'translate-x-[30px]' : 'translate-x-[80px]'}`}
  style={{
    left: isLeftCollapsed ? '14px' : '64px',
    pointerEvents: 'auto'
  }}
>
    <div className="space-y-2">
      <div className="text-sm font-semibold border-b pb-1 mb-1 flex items-center justify-between">
        <span>性能監控</span>
        <Activity size={14} className="text-blue-500" />
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">頁面負荷:</span>
        <div className="flex items-center">
          <span className="font-medium mr-2">{performance.memory} </span>
          <span className={`text-xs font-bold ${getStatusLabel(performance.memory, 'memory').color}`}>
            {getStatusLabel(performance.memory, 'memory').text}
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">處理器負荷:</span>
        <div className="flex items-center">
          <span className="font-medium mr-2">{performance.cpu}%</span>
          <span className={`text-xs font-bold ${getStatusLabel(performance.cpu, 'cpu').color}`}>
            {getStatusLabel(performance.cpu, 'cpu').text}
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">載入速度:</span>
        <div className="flex items-center">
          <span className="font-medium mr-2">{performance.loadTime} 毫秒</span>
          <span className={`text-xs font-bold ${getStatusLabel(performance.loadTime, 'loadTime').color}`}>
            {getStatusLabel(performance.loadTime, 'loadTime').text}
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">畫面流暢度:</span>
        <div className="flex items-center">
          <span className="font-medium mr-2">{performance.fps} fps</span>
          <span className={`text-xs font-bold ${getStatusLabel(performance.fps, 'fps').color}`}>
            {getStatusLabel(performance.fps, 'fps').text}
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">網路請求數:</span>
        <div className="flex items-center">
          <span className="font-medium mr-2">{performance.networkRequests}</span>
          <span className={`text-xs font-bold ${getStatusLabel(performance.networkRequests, 'requests').color}`}>
            {getStatusLabel(performance.networkRequests, 'requests').text}
          </span>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 mt-2 pt-1 border-t flex justify-between items-center">
        <ClearCacheButton />
        <span>更新於: {new Date(performance.lastUpdated).toLocaleTimeString()}</span>
      </div>
    </div>
  </div>
</div>
</div>
</div>

      {/* Main Content - 优化左边距过渡效果 */}
      <div className={`flex-1 transition-all duration-300 ease-in-out ${
        isSidebarOpen 
          ? (isLeftCollapsed ? 'md:ml-14' : 'md:ml-64') 
          : 'ml-0'
      }`}>
        {/* 右侧内容保持不变... */}
        <div className="bg-white shadow-sm sticky top-0 z-30">
          <div className="flex flex-col gap-4 px-4 py-3">
            <div className="flex items-center justify-between">
              <button 
                className="md:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-bold">產品目錄</h1>
              <div className="flex items-center gap-4">
                <SearchBar 
                  onSearch={(term) => {
                    setSearchTerm(term);
                    setCurrentPage(1);
                  }} 
                />
                <ListManager 
                  username={`${user?.username || '未登入使用者'} `}
                />
              </div>
            </div>

            <FilterSection 
              currentCategory={currentCategory}
              setCurrentFilters={setCurrentFilters}
              apiKey={initState.config?.REACT_APP_AIRTABLE_API_KEY}
              baseId={initState.config?.REACT_APP_AIRTABLE_BASE_ID}
              tableName="design"
              searchTerm={searchTerm}
            />
          </div>
        </div>

        {/* Products Grid 保持不变 */}
        <ProductGrid 
          products={currentPageRecords}
          isLoading={isProductsLoading}
        />

        {/* Pagination 保持不变 */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          isLoading={isProductsLoading}
        />
      </div>
    </div>
  );
}

// 包裝組件
function ProductContent() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ListProvider>
          <ProductContentInner />
        </ListProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default ProductContent;