// App.js 修改版 - 結合螢幕尺寸和設備類型判斷
import React, { useState, useEffect, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductContent from './components/ProductContent';
import { ListProvider } from './components/ListContext';
import Auth from './components/Auth';
import { logger } from './config/config';
import { AuthProvider } from './components/AuthContext';
import ScreenshotPrevention from './components/ScreenshotPrevention'; // 截圖
import './styles/screenshotPrevention.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { EnhancedToastProvider } from './components/EnhancedToastContext'; // 確保路徑正確


// 懶加載
const AdminManagement = React.lazy(() => import('./components/IntegratedManagement'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    isMobileDevice: false,    // 是否為移動設備
    isSmallScreen: false,     // 是否為小螢幕
    shouldBlockAccess: false  // 是否應該阻止訪問
  });
  const [deviceInfo, setDeviceInfo] = useState({
    type: '未知',
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    touchEnabled: 'checking...'
  });

  useEffect(() => {
    // 檢測設備類型和螢幕尺寸
    const checkDeviceAndScreen = () => {
      // 檢測是否為移動設備
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
      const isMobileByUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
      
      // 檢測觸摸功能
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 ||
                           navigator.msMaxTouchPoints > 0;
                           
      // 檢測設備方向感應器
      const hasOrientationSupport = !!window.DeviceOrientationEvent;
      
      // 檢測小螢幕 - 小於 1000x700
      const isSmallScreen = window.innerWidth < 1000 || window.innerHeight < 700;
      
      // 確定是否是移動設備 (至少符合兩個移動設備特徵)
      let mobileFeatureCount = 0;
      if (isMobileByUA) mobileFeatureCount++;
      if (isTouchDevice) mobileFeatureCount++;
      if (hasOrientationSupport && userAgent.indexOf('mac os') === -1) mobileFeatureCount++; // 排除 Mac 電腦
      
      const isMobileDevice = mobileFeatureCount >= 2;
      
      // 更新設備信息
      setDeviceInfo({
        type: isMobileDevice ? '移動設備' : '桌面設備',
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        touchEnabled: isTouchDevice ? '是' : '否',
        hasSmallScreen: isSmallScreen ? '是' : '否'
      });
      
      // 只有同時是移動設備且螢幕較小時才阻止訪問
      const shouldBlockAccess = isMobileDevice && isSmallScreen;
      
      setDeviceStatus({
        isMobileDevice,
        isSmallScreen,
        shouldBlockAccess
      });
    };

    // 初始檢查
    checkDeviceAndScreen();

    // 監聽視窗大小變化
    window.addEventListener('resize', checkDeviceAndScreen);

    // 禁用右鍵菜單全局設置
    const disableRightClick = (e) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', disableRightClick);

    // 禁用開發者工具
    const disableDevTools = () => {
      // Detect F12 key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || 
            // Detect Ctrl+Shift+I (Chrome/Edge/Firefox)
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
            // Detect Ctrl+Shift+J (Chrome)
            (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
            // Detect Ctrl+Shift+C (Chrome)
            (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
            // Detect Cmd+Option+I (Mac)
            (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i'))) {
          e.preventDefault();
          return false;
        }
      });

      // Additional check for devtools opening
      const checkDevTools = () => {
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        
        if (widthThreshold || heightThreshold) {
          // If devtools might be open, you could redirect or show a warning
          document.body.innerHTML = '<h1>開發者工具已被禁用</h1>';
        }
      };

      // Run check periodically
      setInterval(checkDevTools, 1000);
    };

    // 只在特定域名下應用
    if (window.location.hostname.includes('design.shummi.com.tw')) {
      disableDevTools();
    }

    const checkAuth = async () => {
      try {
        const savedSession = localStorage.getItem('authSession');
        const savedUser = localStorage.getItem('user');

        if (savedSession && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          logger.debug('User session restored:', parsedUser.username);
        }
      } catch (error) {
        logger.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // 清理事件監聽器
    return () => {
      document.removeEventListener('contextmenu', disableRightClick);
      window.removeEventListener('resize', checkDeviceAndScreen);
      // Cannot remove the interval here as it's not stored in a ref
    };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    logger.debug('User logged in:', userData.username);
  };

  const handleLogout = () => {
    localStorage.removeItem('authSession');
    localStorage.removeItem('user');
    setUser(null);
    setShowAdmin(false);
    queryClient.clear();
    logger.debug('User logged out');
  };

  // 檢查用戶是否有登出權限
  const canLogout = user && (user.username === 'admin' || user.username === 'una.yang');

  // 如果既是小螢幕又是移動設備，才顯示提示訊息
  if (deviceStatus.shouldBlockAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">請使用電腦或更大的螢幕</h2>
        <p className="mb-4">此應用程式需要電腦設備和足夠大的螢幕（至少 1000x700 像素）才能正常使用。</p>
        <div className="mt-4 p-4 bg-white rounded shadow-sm text-left max-w-md">
          <h3 className="font-semibold mb-2">設備資訊:</h3>
          <ul className="text-sm">
            <li><span className="font-medium">設備類型:</span> {deviceInfo.type}</li>
            <li><span className="font-medium">螢幕尺寸:</span> {deviceInfo.screenSize}</li>
            <li><span className="font-medium">螢幕太小:</span> {deviceInfo.hasSmallScreen}</li>
            <li><span className="font-medium">觸控功能:</span> {deviceInfo.touchEnabled}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">載入中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Auth onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <EnhancedToastProvider>
    <QueryClientProvider client={queryClient}>
      <ListProvider>
      <ScreenshotPrevention>
        <div className="min-h-screen bg-gray-50">
          {/* 頂部導航欄 */}
          <nav className="bg-white shadow-sm">
            <div className="px-4">
              <div className="flex justify-end h-16">
                <div className="flex items-center space-x-6">
                  <span className="text-lg font-semibold">
                    歡迎, {user.username}
                  </span>
                  {user.username === 'admin' && (
                    <p
                      onClick={() => setShowAdmin(!showAdmin)}
                      className="flex items-center p-5 cursor-pointer hover:bg-gray-100"
                    >
                      {showAdmin ? '返回主頁面' : '管理系統'}
                    </p>
                  )}
                  {canLogout && (
                    <p
                      onClick={handleLogout}
                      className="flex items-center p-5 cursor-pointer hover:bg-gray-100"
                    >
                      登出
                    </p>
                  )}
                </div>
              </div>
            </div>
          </nav>

          {/* 主要內容 */}
          {user.username === 'admin' && showAdmin ? (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入管理介面中...</div>}>
              <AdminManagement />
            </Suspense>
          ) : (
            <AuthProvider>
              <ProductContent />
            </AuthProvider>
          )}
        </div>
        </ScreenshotPrevention>
      </ListProvider>
    </QueryClientProvider>
    </EnhancedToastProvider>

  );
}

export default App;