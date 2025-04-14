import React, { useState, useCallback, memo, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, X, ChevronDown, ChevronUp, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { useList } from './ListContext';
import { Input } from '@/components/ui/input';
import Slider from 'react-slick'; // 導入 Slick 輪播庫
import { useEnhancedToast } from './EnhancedToastContext';


// 完整的 ColorPickerPopup 組件 (修復 Slick 輪播問題)
const ColorPickerPopup = memo(({ 
  isVisible, 
  onClose, 
  productImages,
  selectedImageUrl,
  setSelectedImageUrl,
  localColors, 
  onColorChange, 
  onReset, 
  openListSelectionModal,
  username 
}) => {
  // 合併所有圖片到一個列表
  const allImages = useMemo(() => {
    const mainImagesWithLabel = productImages.main.map(img => ({
      ...img,
      label: "主圖檔"
    }));
    
    const noteImagesWithLabel = productImages.notes.map(img => ({
      ...img,
      label: "備註圖檔"
    }));
    
    return [...mainImagesWithLabel, ...noteImagesWithLabel];
  }, [productImages]);
  
  // 當沒有選擇圖片時，默認選擇第一張圖
  const currentImageUrl = selectedImageUrl || (allImages.length > 0 ? allImages[0].url : '');
  
  // 修復的 Slick 輪播設定
  const sliderSettings = {
    dots: false,
    infinite: false,
    speed: 300,
    slidesToShow: 4,
    slidesToScroll: 2,
    variableWidth: false, // 關閉可變寬度
    adaptiveHeight: false, // 關閉適應高度
    centerMode: false, // 關閉中心模式
    swipeToSlide: true, // 允許滑動到任意幻燈片
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 2
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1
        }
      }
    ]
  };
  
  // 自定義箭頭組件 - 加入自定義類名
  const PrevArrow = (props) => {
    const { className, onClick } = props;
    return (
      <button
        className="custom-slick-prev absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full p-1 shadow-md hover:bg-gray-100 focus:outline-none"
        onClick={onClick}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  };
  
  const NextArrow = (props) => {
    const { className, onClick } = props;
    return (
      <button
        className="custom-slick-next absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full p-1 shadow-md hover:bg-gray-100 focus:outline-none"
        onClick={onClick}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  };
  
  // 為 Slick 輪播添加自定義箭頭
  const sliderSettingsWithArrows = {
    ...sliderSettings,
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />
  };
  
  if (!isVisible) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl mx-4 p-6" style={{ maxHeight: 'calc(100vh - 4rem)', overflowY: 'auto' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">調整顏色</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* 左側面板：圖片預覽和選擇 */}
          <div className="flex-1">
            {/* 顯示選中圖片預覽 */}
            <div className="relative mb-4 border rounded-lg overflow-hidden bg-gray-50"  style={{ 
              width: '500px', 
              height: '250px',  // 固定高度
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {currentImageUrl ? (
                <img 
                  src={currentImageUrl}
                  alt="產品圖片預覽"
                  className="w-full h-full object-contain pointer-events-none"
                  style={{
                    filter: `hue-rotate(${localColors.hue}deg) 
                            saturate(${localColors.saturation}%) 
                            brightness(${localColors.lightness}%)`
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Image className="w-12 h-12 text-gray-400" />
                  <p className="ml-2 text-gray-500">無可用圖片</p>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                <div className="bg-black bg-opacity-30 p-2 rounded">
                  {username}
                </div>
              </div>
            </div>
            
            {/* 圖片選擇列表 - 修復 Slick 輪播寬度問題 */}
            <div className="mb-4" style={{ width: '500px' }}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">選擇圖片</h4>
                <span className="text-xs text-gray-500">
                  {allImages.length > 0 ? `共 ${allImages.length} 張圖片` : '無可用圖片'}
                </span>
              </div>
              
              {allImages.length > 0 ? (
                <div className="relative" style={{ width: '100%', overflow: 'hidden' }}>
                  {/* 對 Slick 的容器應用固定寬度和溢出隱藏 */}
                  <div className="slick-container" style={{ width: '100%' }}>
                    <Slider {...sliderSettingsWithArrows}>
                      {allImages.map((img, index) => (
                        <div key={`img-${index}`} className="px-1">
                          <div 
                            onClick={() => setSelectedImageUrl(img.url)}
                            className={`relative cursor-pointer border rounded-md overflow-hidden h-16 group ${
                              currentImageUrl === img.url ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <img 
                              src={img.url} 
                              alt={`圖片 ${index + 1}`}
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-end justify-center">
                              <span className="text-xs bg-black bg-opacity-60 text-white px-1 py-0.5 hidden group-hover:block">
                                {img.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </Slider>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 border rounded">
                  無可用圖片
                </div>
              )}
            </div>
          </div>
          
          {/* 右側面板：調色控制項 */}
          <div className="flex-1 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-medium mb-4">顏色調整</h4>
            
            {/* 調色控制項 */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">色相 (0-360):</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={localColors.hue}
                    onChange={(e) => onColorChange('hue', e.target.value)}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={localColors.hue}
                    onChange={(e) => onColorChange('hue', e.target.value)}
                    className="w-16 h-8 text-xs text-right border rounded px-2"
                  />
                  <span className="w-4 text-xs">°</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">飽和度 (0-100):</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={localColors.saturation}
                    onChange={(e) => onColorChange('saturation', e.target.value)}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={localColors.saturation}
                    onChange={(e) => onColorChange('saturation', e.target.value)}
                    className="w-16 h-8 text-xs text-right border rounded px-2"
                  />
                  <span className="w-4 text-xs">%</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">亮度 (65-135):</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="65" 
                    max="135" 
                    value={localColors.lightness}
                    onChange={(e) => onColorChange('lightness', e.target.value)}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="65"
                    max="135"
                    value={localColors.lightness}
                    onChange={(e) => onColorChange('lightness', e.target.value)}
                    className="w-16 h-8 text-xs text-right border rounded px-2"
                  />
                  <span className="w-4 text-xs">%</span>
                </div>
              </div>
            
            </div>
            
            {/* 按鈕區域 */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
              >
                重置顏色
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  openListSelectionModal();
                  onClose();
                }}
                className="flex items-center"
                disabled={!currentImageUrl}
              >
                <Save className="w-4 h-4 mr-1" />
                加入清單
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
ColorPickerPopup.displayName = 'ColorPickerPopup';
// 提取清單選擇模態框
const ListSelectionModal = memo(({ isOpen, onClose, savedLists, newListName, setNewListName, createNewList, addToList }) => {
  // 任何可能的 hooks 应该放在这里
  
  // 条件返回放在所有可能的 hooks 之后
  if (!isOpen) return null;
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && newListName.trim()) {
      createNewList();
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{ touchAction: 'none' }}
    >
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold">選擇清單</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 border-b bg-white">
          <div className="flex gap-2">
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="輸入新清單名稱"
              className="flex-1"
              maxLength={50}
            />
            <Button 
              onClick={createNewList}
              disabled={!newListName.trim()}
            >
              建立清單
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {Object.keys(savedLists).length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                請在上方建立新的清單
              </p>
            ) : (
              Object.keys(savedLists).map(listName => (
                <Button
                  key={listName}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => addToList(listName)}
                >
                  {listName}
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
ListSelectionModal.displayName = 'ListSelectionModal';

// 產品圖片組件
const ProductImage = memo(({ productImage, imageLoaded, setImageLoaded, localColors, username }) => {
  return (
    <div className="relative group min-h-[12rem]">
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-pulse w-full h-48 bg-gray-200 rounded" />
        </div>
      )}
      {productImage && (
        <img 
          loading="lazy"
          src={productImage}
          alt="產品圖片"
          className={`w-full h-48 object-contain pointer-events-none transition-opacity ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          style={{
            filter: `hue-rotate(${localColors.hue}deg) 
                    saturate(${localColors.saturation}%) 
                    brightness(${localColors.lightness}%)`
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
        <div className="bg-black bg-opacity-30 p-2 rounded">
          {username}
        </div>
      </div>
    </div>
  );
});
ProductImage.displayName = 'ProductImage';

// 主組件
const ProductCard = memo(({ product, username = '未登入使用者' }) => {  
  const { savedLists, setSavedLists } = useList();
  const [showColorPickerPopup, setShowColorPickerPopup] = useState(false);
  const [showProductInfo, setShowProductInfo] = useState(false);
  const [showListSelectionModal, setShowListSelectionModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [localColors, setLocalColors] = useState({
    hue: 0,
    saturation: 100,
    lightness: 100
  });
  const [newListName, setNewListName] = useState('');
  const [selectedImageType, setSelectedImageType] = useState('main');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const { showToast, showConfirm } = useEnhancedToast(); // 通知功能

  
  // 使用 useMemo 緩存產品圖片 URL
  const productImages = useMemo(() => {
    const mainImages = product.fields['圖檔'] || [];
    const noteImages = product.fields['備註圖檔'] || [];
    
    return {
      main: mainImages.map(img => ({ 
        url: img.url, 
        filename: img.filename, 
        type: 'main' 
      })),
      notes: noteImages.map(img => ({ 
        url: img.url, 
        filename: img.filename, 
        type: 'note' 
      }))
    };
  }, [product.fields]);
  
  // 主圖檔URL
  const productImage = useMemo(() => {
    return productImages.main.length > 0 ? productImages.main[0].url : '';
  }, [productImages]);

  // 緩存產品資訊 - 將此處移到 addToList 函數之前
  const productInfo = useMemo(() => ({
    id: product.fields['美工圖編號'],
    name: product.fields['美工圖名稱'],
    year: product.fields['設計年份1'],
    designer: product.fields['設計者1'],
    feature: product.fields['產品特色1'],
    injection: product.fields['射出'],
    mold: product.fields['模具'],
    commodity: product.fields['成品編號']
  }), [product.fields]);

  // 優化：重置顏色的回調函數
  const resetColors = useCallback(() => {
    setLocalColors({ hue: 0, saturation: 100, lightness: 100 });
  }, []);

  // 建立新清單
  const createNewList = useCallback(() => {
    if (newListName.trim() && !savedLists[newListName.trim()]) {
      setSavedLists(prev => ({
        ...prev,
        [newListName.trim()]: []
      }));
      setNewListName('');
    }
  }, [newListName, savedLists, setSavedLists]);

// 處理添加到清單
const addToList = useCallback((listName) => {
  try {
    // 使用當前選中的圖片URL，如果沒有則使用默認的主圖
    const currentImageUrl = selectedImageUrl || (productImages.main.length > 0 ? productImages.main[0].url : '');
    
    if (!currentImageUrl) {
      showToast('無法加入清單：沒有可用的圖片', 'error', 1500);
      return;
    }
    
    // 先檢查是否存在相同產品和顏色設定
    const existingList = savedLists[listName] || [];
    const existingProductIndex = existingList.findIndex(item => item.id === product.id);
    
    // 為比較準備精確的顏色值 (轉為整數避免浮點數比較問題)
    const currentHue = Math.round(Number(localColors.hue));
    const currentSaturation = Math.round(Number(localColors.saturation));
    const currentLightness = Math.round(Number(localColors.lightness));
    
    // 計算當前圖片在陣列中的位置
    const getCurrentImageIndex = () => {
      if (!currentImageUrl) return -1;
      
      // 合併所有圖片到一個列表
      const allImages = [
        ...productImages.main.map(img => img.url),
        ...productImages.notes.map(img => img.url)
      ];
      
      // 找出當前圖片的索引
      return allImages.findIndex(url => url === currentImageUrl);
    };
    
    const currentImageIndex = getCurrentImageIndex();
    
    // 創建新變體
    const newVariant = {
      colors: { 
        hue: currentHue,
        saturation: currentSaturation,
        lightness: currentLightness
      },
      originalImageUrl: currentImageUrl,
      imageIndex: currentImageIndex,
      timestamp: new Date().toISOString()
    };
    
    // 如果產品已存在於清單
    if (existingProductIndex !== -1) {
      const existingProduct = existingList[existingProductIndex];
      
      // 比對產品ID、顏色設定和圖片位置
      const hasSameVariant = existingProduct.colorVariants?.some(variant => {
        // 檢查顏色值是否相同
        const sameHue = Math.round(Number(variant.colors.hue)) === currentHue;
        const sameSaturation = Math.round(Number(variant.colors.saturation)) === currentSaturation; 
        const sameLightness = Math.round(Number(variant.colors.lightness)) === currentLightness;
        
        // 檢查圖片位置是否相同
        const sameImage = variant.imageIndex === currentImageIndex;
        
        return sameHue && sameSaturation && sameLightness && sameImage;
      });

      // 如果有相同變體，使用擴展的Toast系統的showConfirm來詢問用戶是否仍要添加
      if (hasSameVariant) {
        showConfirm(
          `${listName} 已有相同顏色設定的 ${productInfo.id} 產品，是否仍要加入？`,
          // 確認回調
          () => {
            // 用戶選擇確認添加，繼續下面的添加操作
            // 添加新變體到現有產品
            setSavedLists(prev => {
              try {
                const updatedList = [...prev[listName]];
                updatedList[existingProductIndex] = {
                  ...existingProduct,
                  colorVariants: [...(existingProduct.colorVariants || []), newVariant]
                };
                
                // 使用 Toast 顯示成功訊息
                showToast(`已將 ${productInfo.id} 的新顏色版本加入 ${listName} 清單`, 'success', 1000);
                
                return {
                  ...prev,
                  [listName]: updatedList
                };
              } catch (err) {
                console.error('加入清單失敗:', err);
                showToast('加入清單失敗', 'error', 1500);
                return prev;
              }
            });
            
            // 關閉模態框並重置顏色
            setShowListSelectionModal(false);
            resetColors();
          },
          // 取消回調
          () => {
            // 用戶選擇不添加
            setShowListSelectionModal(false);
          }
        );
        
        // 這裡需要return，因為後續的操作會在用戶做出選擇後通過回調函數執行
        return;
      }

      // 如果沒有相同變體，直接添加
      setSavedLists(prev => {
        try {
          const updatedList = [...prev[listName]];
          updatedList[existingProductIndex] = {
            ...existingProduct,
            colorVariants: [...(existingProduct.colorVariants || []), newVariant]
          };
          
          // 使用 Toast 顯示成功訊息
          showToast(`已將 ${productInfo.id} 的新顏色版本加入 ${listName} 清單`, 'success', 1000);
          
          return {
            ...prev,
            [listName]: updatedList
          };
        } catch (err) {
          console.error('加入清單失敗:', err);
          showToast('加入清單失敗', 'error', 1500);
          return prev;
        }
      });
    } else {
      // 產品不存在，添加新產品與變體
      setSavedLists(prev => {
        try {
          // 使用 Toast 顯示成功訊息
          showToast(`已將 ${productInfo.id} 加入 ${listName} 清單`, 'success', 1000);
          
          return {
            ...prev,
            [listName]: [
              ...existingList,
              {
                id: product.id,
                ...product,
                colorVariants: [newVariant]
              }
            ]
          };
        } catch (err) {
          console.error('加入清單失敗:', err);
          showToast('加入清單失敗', 'error', 1500);
          return prev;
        }
      });
    }
    
    // 關閉模態框並重置顏色
    setShowListSelectionModal(false);
    resetColors();
  } catch (err) {
    // 捕獲任何未處理的錯誤
    console.error('加入清單時發生錯誤:', err);
    showToast('操作失敗，請稍後再試', 'error', 1500);
  }
}, [product, savedLists, setSavedLists, localColors, selectedImageUrl, productImages, resetColors, productInfo.id, showToast, showConfirm]);

// 處理顏色變化
  const handleColorChange = useCallback((type, value) => {
    setLocalColors(prev => ({
      ...prev,
      [type]: parseInt(value)
    }));
  }, []);

  // 開啟調色器彈出視窗
  const openColorPickerPopup = useCallback(() => {
    setShowColorPickerPopup(true);
  }, []);

  // 關閉調色器彈出視窗
  const closeColorPickerPopup = useCallback(() => {
    setShowColorPickerPopup(false);
  }, []);

  const toggleProductInfo = () => {
    setShowProductInfo(!showProductInfo);
  };

  // 開啟清單選擇模態框
  const openListSelectionModal = useCallback(() => {
    setShowListSelectionModal(true);
  }, []);

  // 關閉清單選擇模態框
  const closeListSelectionModal = useCallback(() => {
    setShowListSelectionModal(false);
  }, []);

  return (
    <Card className="relative bg-white rounded-lg shadow-md p-4">
      <ProductImage 
        productImage={productImage}
        imageLoaded={imageLoaded}
        setImageLoaded={setImageLoaded}
        localColors={localColors}
        username={username}
      />

      <div className="mt-2">
        <div className='flex justify-between items-center my-1'>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleProductInfo}
              className="h-8"
            >
              {showProductInfo ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
            <h3 className="text-lg font-bold">{productInfo.id}</h3>
          </div>
          <div className="flex bg-gray-100">
            <p className="text-sm text-gray-600">{productInfo.mold}-</p>
            <p className="text-sm text-gray-600">{productInfo.commodity}</p>
          </div>
        </div>
        
        {showProductInfo && (
          <div className='pl-3'>
            <p className="text-sm text-gray-600">名稱: {productInfo.name}</p>
            <p className="text-sm text-gray-600">年份: {productInfo.year}</p>
            <p className="text-sm text-gray-600">設計者: {productInfo.designer}</p>
            <p className="text-sm text-gray-600">產品特色: {productInfo.feature}</p>
            <p className="text-sm text-gray-600">射出: {productInfo.injection}</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between space-x-2">
      <Button 
          variant="outline"
          size="sm"
          onClick={openColorPickerPopup}
          disabled={!imageLoaded}
        >
          調整顏色
        </Button>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => {
            // 直接使用原始圖片和默認顏色
            setSelectedImageUrl(productImage);
            setLocalColors({ hue: 0, saturation: 100, lightness: 100 });
            openListSelectionModal();
          }}
          disabled={!imageLoaded}
          className="flex items-center"
        >
          <Save className="w-4 h-4 mr-1" />
          加入清單
        </Button>
       
      </div>

      {/* 彈出式調色器視窗 */}
      <ColorPickerPopup 
        isVisible={showColorPickerPopup}
        onClose={closeColorPickerPopup}
        productImages={productImages}
        selectedImageUrl={selectedImageUrl}
        setSelectedImageUrl={setSelectedImageUrl}
        localColors={localColors}
        onColorChange={handleColorChange}
        onReset={resetColors}
        openListSelectionModal={openListSelectionModal}
        username={username}
      />

      {/* 清單選擇模態框 */}
      <ListSelectionModal 
        isOpen={showListSelectionModal}
        onClose={closeListSelectionModal}
        savedLists={savedLists}
        newListName={newListName}
        setNewListName={setNewListName}
        createNewList={createNewList}
        addToList={addToList}
      />
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;