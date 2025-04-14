// src/components/CaptureReport.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Ban, 
  Calendar, 
  Eye, 
  Filter, 
  Printer, 
  RefreshCw, 
  Search, 
  User, 
  X,
  Download,
  AlertTriangle
} from 'lucide-react';
import { logger } from '../config/config';

/**
 * 截圖記錄報告組件
 * 用於管理員查看和分析用戶截圖行為
 */
const CaptureReport = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    username: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // 定義行為類型映射
  const actionTypes = {
    'windows截圖': { name: '截圖按鍵', icon: <Eye size={18} />, color: 'text-yellow-500' },
    '視窗轉換(可能的截圖行為，也可能誤判)': { name: '視窗切換', icon: <Eye size={18} />, color: 'text-blue-500' },
    '嘗試列印': { name: '列印嘗試', icon: <Printer size={18} />, color: 'text-red-500' },
    'dom_manipulation': { name: 'DOM 操作', icon: <AlertTriangle size={18} />, color: 'text-orange-500' },
    'html2canvas_detected': { name: 'Canvas截圖', icon: <AlertTriangle size={18} />, color: 'text-red-500' },
    '嘗試開啟開發者工具': { name: '開發者工具', icon: <AlertTriangle size={18} />, color: 'text-red-500' },
    'windows_key_full_block': { name: 'Windows鍵阻擋', icon: <Ban size={18} />, color: 'text-gray-500' }
  };

  // 加載截圖日誌
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('../api/admin/get-capture-logs.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters,
          sort: { field: sortBy, order: sortOrder },
          pagination: { page, itemsPerPage }
        })
      });

      if (!response.ok) {
        throw new Error(`伺服器錯誤: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error(data.error || '加載日誌失敗');
      }
    } catch (error) {
      logger.error('加載截圖日誌失敗:', error);
      setError('無法加載日誌數據。' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, sortBy, sortOrder, page]);

  // 初始加載
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 處理過濾器變更
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // 清除過濾器
  const clearFilters = () => {
    setFilters({
      username: '',
      action: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  // 應用過濾器
  const applyFilters = () => {
    setPage(1);
    loadLogs();
  };

  // 處理排序變更
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 匯出日誌為CSV
  const exportToCsv = () => {
    if (logs.length === 0) return;

    // 準備CSV標頭
    const headers = ['用戶名', '行為', '時間', 'IP位址', '瀏覽器', '詳情'];
    
    // 構建CSV內容
    let csvContent = headers.join(',') + '\n';
    
    logs.forEach(log => {
      const row = [
        log.user || '',
        actionTypes[log.action]?.name || log.action || '',
        log.timestamp || '',
        log.ip || '',
        log.userAgent || '',
        log.details ? `"${log.details.replace(/"/g, '""')}"` : ''
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // 建立下載連結
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `截圖記錄_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">截圖行為紀錄</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadLogs}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            重新載入
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCsv}
            disabled={isLoading || logs.length === 0}
          >
            <Download size={16} className="mr-2" />
            匯出CSV
          </Button>
        </div>
      </div>

      {/* 過濾器區域 */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">用戶名</label>
            <div className="relative">
              <input
                type="text"
                name="username"
                value={filters.username}
                onChange={handleFilterChange}
                placeholder="搜尋用戶"
                className="w-full p-2 border rounded-md pl-8"
              />
              <User size={16} className="absolute left-2.5 top-3 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">行為類型</label>
            <div className="relative">
              <select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-md pl-8 appearance-none bg-white"
              >
                <option value="">所有行為</option>
                {Object.entries(actionTypes).map(([key, { name }]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
              <Filter size={16} className="absolute left-2.5 top-3 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">開始日期</label>
            <div className="relative">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-md pl-8"
              />
              <Calendar size={16} className="absolute left-2.5 top-3 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">結束日期</label>
            <div className="relative">
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full p-2 border rounded-md pl-8"
              />
              <Calendar size={16} className="absolute left-2.5 top-3 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={16} className="mr-2" />
            清除過濾
          </Button>
          <Button onClick={applyFilters}>
            <Search size={16} className="mr-2" />
            套用過濾
          </Button>
        </div>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* 日誌表格 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('user')}
              >
                <div className="flex items-center">
                  <span>用戶名</span>
                  {sortBy === 'user' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('action')}
              >
                <div className="flex items-center">
                  <span>行為</span>
                  {sortBy === 'action' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('timestamp')}
              >
                <div className="flex items-center">
                  <span>時間</span>
                  {sortBy === 'timestamp' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP位址
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                詳情
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw size={20} className="animate-spin mr-2" />
                    <span>載入中...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  沒有符合條件的記錄
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={log.logId || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.user || '未知用戶'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center ${actionTypes[log.action]?.color || 'text-gray-700'}`}>
                      {actionTypes[log.action]?.icon || <Ban size={18} />}
                      <span className="ml-2">{actionTypes[log.action]?.name || log.action || '未知行為'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(log.timestamp).toLocaleString('zh-TW')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {log.ip || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="max-w-xs truncate">
                      {log.details || '無詳細資訊'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-500">
          {logs.length > 0 ? (
            <>顯示 {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, logs.length)} 筆</>
          ) : (
            <>沒有記錄</>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            上一頁
          </Button>

          <span className="mx-2 flex items-center text-sm">
            第 {page} / {totalPages} 頁
          </span>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
          >
            下一頁
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default CaptureReport;