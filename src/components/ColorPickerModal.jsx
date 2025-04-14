// ColorPickerModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { X, Pipette, Check, Trash2 } from "lucide-react";
import { saveColorToDB, loadColorsFromDB, deleteColorFromDB } from '../utils/dbUtils';

// 顏色轉換函數
const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hslToRgb = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4))
  ];
};

const ColorPickerModal = ({ isOpen, onClose, onColorSelect, selectedVariant, listName, productId, variantImage, user, expandedVariants, item, username, handleOpenColorPicker, removeColorVariant, VariantCard }) => {
  const [selectedColor, setSelectedColor] = useState(null);
  const [pickedColors, setPickedColors] = useState([]);
  // 移除不支援的EyeDropper API 參考
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const imageContainerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // 計算 hexColor (添加這行)
  const hexColor = selectedColor 
    ? hslToHex(selectedColor.hue, selectedColor.saturation, selectedColor.lightness)
    : '';

  // 直接在組件中實現浮水印功能
  const applyWatermark = () => {
    console.log("開始應用浮水印...");
    if (!imageContainerRef.current || !user || !variantImage) {
      console.log("無法應用浮水印: 缺少必要條件", { 
        hasContainer: !!imageContainerRef.current, 
        hasUser: !!user, 
        hasImage: !!variantImage 
      });
      return;
    }
    
    // 移除現有浮水印
    const existingCanvas = imageContainerRef.current.querySelector('.watermark-canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    
    // 獲取容器尺寸
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    
    // 創建 Canvas 元素
    const canvas = document.createElement('canvas');
    canvas.className = 'watermark-canvas';
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    
    const ctx = canvas.getContext('2d');
    
    // 設置浮水印樣式
    ctx.fillStyle = 'rgba(3, 3, 3, 0.4)';  // 半透明灰色
    ctx.font = '12px Arial';
    
    // 當前時間
    const now = new Date();
    const timeString = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 兩行浮水印文本
    const watermarkText2 = `${user.username}`;
    const watermarkText1 = `${timeString}`;
    
    console.log("浮水印文本:", watermarkText1, watermarkText2);
    
    // 在 Canvas 上繪製水平排列但位置錯開的浮水印
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6); // 旋轉約 -30 度
    
    const text1Width = ctx.measureText(watermarkText1).width;
    const text2Width = ctx.measureText(watermarkText2).width;
    const maxWidth = Math.max(text1Width, text2Width);
    const spacing = maxWidth * 2;
    const lineHeight = 24; // 增加行高使水平行間距更大
    
    // 第一種模式：用戶名的行
    for (let y = -canvas.height * 1.5; y < canvas.height * 1.5; y += lineHeight * 2) {
      for (let x = -canvas.width * 1.5; x < canvas.width * 1.5; x += spacing) {
        ctx.fillText(watermarkText1, x, y);
      }
    }
    
    // 第二種模式：時間戳的行 - 水平錯位
    for (let y = -canvas.height * 1.5 + lineHeight; y < canvas.height * 1.5; y += lineHeight * 2) {
      for (let x = -canvas.width * 1.5 + spacing / 2; x < canvas.width * 1.5; x += spacing) {
        ctx.fillText(watermarkText2, x, y);
      }
    }
    
    ctx.restore();
    
    // 將 Canvas 添加到圖片容器
    imageContainerRef.current.appendChild(canvas);
    console.log("浮水印已應用");
  };

  // 全局禁止右鍵選單和複製行為
  useEffect(() => {
    const disableRightClick = (e) => {
      if (isOpen && e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };
    
    const disableCopy = (e) => {
      if (isOpen && e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };
    
    // 禁用圖片拖拽
    const disableDrag = (e) => {
      if (isOpen && e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    };
    
    if (isOpen) {
      document.addEventListener('contextmenu', disableRightClick);
      document.addEventListener('copy', disableCopy);
      document.addEventListener('dragstart', disableDrag);
      
      // 禁用圖片的各種保存選項
      const style = document.createElement('style');
      style.innerHTML = `
        img {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.removeEventListener('contextmenu', disableRightClick);
        document.removeEventListener('copy', disableCopy);
        document.removeEventListener('dragstart', disableDrag);
        document.head.removeChild(style);
      };
    }
    
    return () => {};
  }, [isOpen]);

  // 初始化和載入色票
  useEffect(() => {
    const loadSavedColors = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      setError(null);
      try {
        const colors = await loadColorsFromDB(listName, productId, selectedVariant);
        setPickedColors(colors);
      } catch (err) {
        console.error('Error loading colors:', err);
        setError('載入顏色失敗');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadSavedColors();
    }
  }, [isOpen, listName, productId, selectedVariant]);

  // 圖片和DOM載入後應用浮水印
  useEffect(() => {
    // 等待DOM元素和圖片都加載完成
    if (isOpen && variantImage && user && imageContainerRef.current) {
      console.log("監測到條件滿足，準備應用浮水印");
      
      // 創建一個Image對象來檢查圖片是否加載完成
      const img = new Image();
      img.onload = () => {
        console.log("圖片加載完成，應用浮水印");
        // 確保DOM已經更新
        setTimeout(() => {
          applyWatermark();
        }, 100);
      };
      img.src = variantImage;
    }
  }, [isOpen, variantImage, user]);

  // 處理視窗調整大小時重新應用浮水印
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && variantImage && user && imageContainerRef.current) {
        applyWatermark();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, variantImage, user]);

  // 處理色票選擇和刪除
  const handleSelectSavedColor = (color) => {
    if (isDeleteMode) {
      handleDeleteColor(color.id);
    } else {
      setSelectedColor({
        hue: color.hue,
        saturation: color.saturation,
        lightness: color.lightness
      });
    }
  };

  const handleDeleteColor = async (colorId) => {
    try {
      await deleteColorFromDB(colorId);
      setPickedColors(prev => prev.filter(color => color.id !== colorId));
    } catch (error) {
      console.error('Error deleting color:', error);
      setError('刪除顏色失敗');
    }
  };

  // 防止圖片右鍵點擊和其他抓取行為
  const handleImageContextMenu = (e) => {
    e.preventDefault();
    return false;
  };
  
  // 防止鼠標進入時出現抓取工具
  const handleImageMouseDown = (e) => {
    if (e.button === 2) { // 右鍵點擊
      e.preventDefault();
      return false;
    }
  };
  
  // 防止拖曳
  const handleImageDragStart = (e) => {
    e.preventDefault();
    return false;
  };

  // 處理顏色選擇
  const handleColorSelect = (hexColor) => {
    // 將十六進制顏色轉換為 HSL
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    const hslColor = {
      hue: Math.round(h * 360),
      saturation: Math.round(s * 100),
      lightness: Math.round(l * 100)
    };

    setSelectedColor(hslColor);
    
    // 儲存顏色
    saveColorToDB(hslColor, listName, productId, selectedVariant)
      .then(saved => {
        if (saved) {
          return loadColorsFromDB(listName, productId, selectedVariant);
        }
      })
      .then(colors => {
        if (colors) {
          setPickedColors(colors);
        }
      })
      .catch(err => {
        console.error('Failed to save color:', err);
        setError('儲存顏色失敗');
      });
  };

    // 複製功能
    const copyHexColor = async () => {
      try {
        // 嘗試使用現代 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(hexColor);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          // 備用方法：使用老式的 document.execCommand 方法
          const textArea = document.createElement("textarea");
          textArea.value = hexColor;
          
          // 確保元素不可見
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          
          // 選擇並複製文本
          textArea.focus();
          textArea.select();
          const success = document.execCommand('copy');
          
          // 清理
          document.body.removeChild(textArea);
          
          if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            console.error('複製失敗: document.execCommand 返回 false');
          }
        }
      } catch (err) {
        console.error('複製失敗:', err);
      }
    };

  // 儲存顏色
  const handleSave = () => {
    if (selectedColor) {
      onColorSelect(selectedColor, listName, productId, selectedVariant);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* 標題區域 */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold">選擇顏色</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 主要內容區域 - 優化的垂直分配 */}
        <div className="flex flex-col h-full overflow-hidden">
          {/* 上半部：顏色選擇器和圖片預覽 */}
          <div className="flex flex-col md:flex-row p-4 flex-grow overflow-auto">
            {/* 左側：顏色控制面板 */}
            <div className="w-full md:w-60 lg:w-72 flex-shrink-0 space-y-4 md:pr-4">
              {/* 顏色選擇區塊 */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium mb-3">顏色選擇</h4>
                <div className="relative">
                  <input
                    type="color"
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="sr-only"
                    id="colorPicker"
                  />
                  <label
                    htmlFor="colorPicker"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full border border-gray-300 bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
                    <span>選擇顏色</span>
                  </label>
                </div>
              </div>

              {/* 選擇的顏色資訊 */}
             {selectedColor && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">已選擇的顏色</h4>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded border flex-shrink-0"
                      style={{
                        backgroundColor: `hsl(${selectedColor.hue}, ${selectedColor.saturation}%, ${selectedColor.lightness}%)`
                      }}
                    />
                    <div className="space-y-1">
                      <p>
                        HEX: 
                        <span 
                          onClick={copyHexColor}
                          className="cursor-pointer mx-1 px-1 font-mono bg-gray-100 rounded relative inline-flex items-center"
                        >
                          {hexColor}
                          {copied && (
                            <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-1 py-0.5 rounded text-center">
                              已複製!
                            </span>
                          )}
                        </span>
                      </p>
                      <p>RGB: ({hslToRgb(selectedColor.hue, selectedColor.saturation, selectedColor.lightness).join(', ')})</p>
                    </div>
                  </div>
                </div>
              )}
                   
            </div>

            {/* 右側：圖片預覽 */}
            <div className="w-full flex-grow border rounded-lg p-2 md:p-4 bg-gray-50 md:ml-4 mt-4 md:mt-0 flex items-center justify-center min-h-[200px] md:min-h-[300px]">
              {variantImage ? (
                <div 
                  className="relative w-full h-full flex items-center justify-center select-none"
                  onContextMenu={handleImageContextMenu}
                  ref={imageContainerRef}
                >
                  <img
                    src={variantImage}
                    alt="Selected variant"
                    className="max-w-full max-h-full object-contain select-none pointer-events-none relative z-0"
                    style={{
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                    }}
                    onContextMenu={handleImageContextMenu}
                    onMouseDown={handleImageMouseDown}
                    onDragStart={handleImageDragStart}
                    onCopy={(e) => e.preventDefault()}
                    draggable="false"
                    onLoad={() => {
                      console.log("圖片加載事件觸發");
                      if (user) applyWatermark();
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>暫無圖片</p>
                </div>
              )}
            </div>
          </div>
          
          {/* 底部區域，包含已儲存的顏色和顏色變體 */}
          <div className="border-t p-4">
            <div className="flex flex-col md:flex-row md:gap-4">
              {/* 已儲存的顏色區域 */}
              <div className="w-full">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">已儲存的顏色</h4>
                  {pickedColors.length > 0 && (
                    <Button
                      variant={isDeleteMode ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setIsDeleteMode(!isDeleteMode)}
                      className="gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleteMode ? "取消刪除" : "刪除模式"}
                    </Button>
                  )}
                </div>
                
                <div className="overflow-y-auto" style={{ maxHeight: "120px" }}>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
                      <p className="mt-2 text-sm text-gray-500">載入色票中...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-4 text-red-500">
                      <p>{error}</p>
                    </div>
                  ) : pickedColors.length > 0 ? (
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                      {pickedColors.map((color) => (
                        <button
                          key={color.id}
                          className="relative group"
                          onClick={() => handleSelectSavedColor(color)}
                        >
                          <div 
                            className={`w-full aspect-square rounded border transition-all
                              ${isDeleteMode ? 'hover:border-red-500' : 'hover:ring-2 hover:ring-blue-500'}`}
                            style={{
                              backgroundColor: `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`
                            }}
                          />
                          {selectedColor && !isDeleteMode && 
                          color.hue === selectedColor.hue && 
                          color.saturation === selectedColor.saturation && 
                          color.lightness === selectedColor.lightness && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>尚未儲存任何顏色</p>
                      <p className="text-sm mt-1">使用顏色選擇器來選取並儲存顏色</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 已保存的顏色變體區域 - 新增加的部分
              <div className="w-full md:w-1/2 mt-4 md:mt-0">
                <h4 className="font-medium mb-2">已保存的顏色變體</h4>
                {item && expandedVariants && expandedVariants[`${listName}-${item.id}`] ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: "120px" }}>
                    {item.colorVariants && item.colorVariants.map((variant, variantIndex) => (
                      <VariantCard 
                        key={variantIndex}
                        variant={variant}
                        variantIndex={variantIndex}
                        item={item}
                        listName={listName}
                        username={username}
                        onOpenColorPicker={handleOpenColorPicker}
                        onRemoveVariant={removeColorVariant}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>尚未展開變體列表</p>
                    <p className="text-sm mt-1">請先展開產品變體列表</p>
                  </div>
                )}
              </div> */}
            </div>
          </div>
          
          
        </div>
      </div>
    </div>
  );
};
  
export default ColorPickerModal;