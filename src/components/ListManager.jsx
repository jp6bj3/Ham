import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2, X, ChevronDown, ChevronUp, Database, Pencil, Check, Search, GripVertical } from 'lucide-react';
import { useList } from './ListContext';
import { processImage, createVariant } from '../utils/ImageProcessor.js';
import ProductNotes from './ProductNotes';
import ColorPickerModal from './ColorPickerModal';
import { deleteColorsByVariant, updateColorVariantIndices } from '../utils/dbUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  calculateObjectSize, 
  formatFileSize, 
  getStorageEstimate,
  updateStorageUsage
} from '../utils/storageUtils';

// 導入 dnd-kit 函式庫
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

// 提取搜尋區域為獨立組件
const SearchArea = memo(({ 
  isExpanded, 
  toggleExpanded, 
  newListName, 
  setNewListName, 
  createNewList, 
  handleKeyPress, 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory, 
  categories,
  filteredItemsCount
}) => {
  return (
    <div 
      className={`sticky top-0 bg-white z-30 transition-all duration-300 space-y-4 border-b
        ${isExpanded ? 'py-4' : 'py-2 shadow-sm'}`}
    >
      <div className="flex items-center justify-between px-6">
        <div className="flex-1">
          {isExpanded ? (
            <div className="space-y-4">
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
              
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜尋商品編號或名稱"
                  className="flex-1"
                />
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="選擇品項" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部品項</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {searchTerm ? 
                  `搜尋結果: ${filteredItemsCount} 個項目` : 
                  '點擊展開搜尋'}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className="ml-2"
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </Button>
      </div>
    </div>
  );
});
SearchArea.displayName = 'SearchArea';

// 提取存儲空間信息組件
const StorageInfo = memo(({ storageInfo }) => {
  const usedPercent = (storageInfo.lists / storageInfo.total) * 100;
  const progressColor = usedPercent > 90 ? 'bg-red-500' : 
                       usedPercent > 70 ? 'bg-yellow-500' : 
                       'bg-blue-500';

  return (
    <div className="px-6 py-3 border-t">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Database className="w-4 h-4" />
        <span>儲存空間使用狀況</span>
      </div>
      
      <div className="mt-2">
        <div className="flex justify-between text-sm mb-1">
          <span>{formatFileSize(storageInfo.lists)} / 50MB</span>
          <span>{usedPercent.toFixed(1)}%</span>
        </div>
        
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
          />
        </div>
        
        {usedPercent > 90 && (
          <p className="text-xs text-red-500 mt-1">
            儲存空間即將用完，請刪除不需要的項目
          </p>
        )}
        {usedPercent > 70 && usedPercent <= 90 && (
          <p className="text-xs text-yellow-500 mt-1">
            儲存空間使用超過 70%，建議適時清理
          </p>
        )}
      </div>
    </div>
  );
});
StorageInfo.displayName = 'StorageInfo';

// 變體卡片組件
const VariantCard = memo(({ 
  variant, 
  variantIndex, 
  item, 
  listName, 
  username, 
  onOpenColorPicker, 
  onRemoveVariant 
}) => {
  return (
    <div className="relative group/variant">
      <div 
        className="relative border rounded-lg overflow-hidden bg-gray-50"
        onClick={() => onOpenColorPicker(listName, item.id, variantIndex)}
      >
        {variant.variantImage ? (
          <div className="relative">
            <img
              src={variant.variantImage}
              alt={`${item.fields['美工圖編號']} - 變體 ${variantIndex + 1}`}
              className="w-full h-32 object-contain pointer-events-none"
              onError={(e) => {
                e.target.style.display = 'none';
                const parent = e.target.parentElement.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-32">
                      <div class="text-gray-400">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span class="mt-1 text-xs text-gray-500">圖片載入失敗</span>
                    </div>
                  `;
                }
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs z-20">
              <div className="bg-black bg-opacity-30 p-2 rounded">
                {username}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
              <div>色相: {variant.colors?.hue || 0}° _
              飽和度: {variant.colors?.saturation || 0}% _
              亮度: {variant.colors?.lightness || 0}%</div>
              <div className="text-xs opacity-75">
                {new Date(variant.timestamp || Date.now()).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-32">
            <div className="animate-pulse w-full h-full bg-gray-200" />
          </div>
        )}
      </div>

      {/* 刪除按鈕 */}
      <div 
        className="absolute top-2 right-2 z-30 opacity-0 group-hover/variant:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.confirm('確定要刪除這個顏色變體嗎？')) {
            onRemoveVariant(listName, item.id, variantIndex);
          }
        }}
      >
        <button
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg"
          title="刪除變體"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 懸停提示 */}
      <div className="absolute inset-0 bg-black/0 group-hover/variant:bg-black/10 transition-colors">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 group-hover/variant:opacity-100 transition-opacity text-sm">
          點擊選取顏色
        </div>
      </div>
    </div>
  );
});
VariantCard.displayName = 'VariantCard';

// 商品卡片組件
const ProductItemCard = memo(({ 
  item, 
  listName, 
  index, 
  preventDefaultActions, 
  removeFromList, 
  setSavedLists, 
  username, 
  expandedVariants, 
  toggleVariantsExpansion, 
  handleOpenColorPicker, 
  removeColorVariant 
}) => {
  return (
    <Card className="p-4 group/item hover:shadow-sm transition-shadow">
      <div className="flex flex-col gap-4">
        {/* 商品基本信息 */}
        <div className="flex gap-4">
          <div 
            className="relative w-24 h-24 shrink-0 rounded overflow-hidden border bg-gray-50 select-none"
            onContextMenu={preventDefaultActions}
            onDragStart={preventDefaultActions}
          >
            {item.colorVariants?.[0]?.processedImage ? (
              <div className="relative w-full h-full">
                <img
                  src={item.colorVariants[0].processedImage}
                  alt={item.fields['美工圖編號']}
                  className="w-full h-full object-contain pointer-events-none"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex flex-col items-center justify-center w-full h-full">
                          <div class="text-gray-400">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 200-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span class="mt-1 text-xs text-gray-500">圖片載入失敗</span>
                        </div>
                      `;
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                  <div className="bg-black bg-opacity-30 p-2 rounded">
                    {username}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full p-2">
                <div className="animate-pulse w-full h-full bg-gray-200 rounded" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">
                  {item.fields['美工圖編號']}
                </h4>
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <p className="text-sm text-gray-600 mt-1 truncate">
                  {item.fields['美工圖名稱']}
                </p>
                <p className="text-sm text-gray-600">
                  設計者: {item.fields['設計者1']}
                </p>
                <p className="text-sm text-gray-600">
                  產品特色: {item.fields['產品特色1']}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-600">
                  成品編號: {item.fields['成品編號']}
                </p>
               
                <p className="text-sm text-gray-600">
                  模具: {item.fields['模具']}
                </p>
                <p className="text-sm text-gray-600">
                  射出: {item.fields['射出']}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFromList(listName, item.id)}
                className="opacity-0 group-hover/item:opacity-100 transition-opacity -mt-1 -mr-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* 筆記組件 */}
            <ProductNotes 
              productId={item.id}
              savedNotes={item.notes || []}
              onSaveNote={(updatedNotes) => {
                setSavedLists(prev => ({
                  ...prev,
                  [listName]: prev[listName].map(listItem => 
                    listItem.id === item.id 
                      ? { ...listItem, notes: updatedNotes }
                      : listItem
                  )
                }));
              }}
            />
          </div>
        </div>
        
        {/* 顏色變體區域 */}
        {item.colorVariants && item.colorVariants.length > 0 && (
          <div className="border-t pt-4">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => toggleVariantsExpansion(listName, item.id)}
            >
              <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                {expandedVariants[`${listName}-${item.id}`] ? 
                  <ChevronUp size={16} /> : 
                  <ChevronDown size={16} />
                }
              </button>
              <h5 className="text-sm font-semibold">
                已保存的顏色變體 ({item.colorVariants.length})
              </h5>
            </div>
            
            {expandedVariants[`${listName}-${item.id}`] && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                {item.colorVariants.map((variant, variantIndex) => (
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
            )}
          </div>
        )}
      </div>
    </Card>
  );
});
ProductItemCard.displayName = 'ProductItemCard';

// SortableListItem 元件包裝了 ListItem 並具有拖放功能
const SortableListItem = ({ listName, items, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: listName });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'cursor-grabbing' : ''}`}>
      <Card className={`p-4 group hover:shadow-md transition-shadow ${isDragging ? 'shadow-xl' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <button
              {...attributes}
              {...listeners}
              className="p-1 hover:bg-gray-100 rounded transition-colors cursor-grab"
              aria-label="拖曳排序"
            >
              <GripVertical size={20} className="text-gray-400" />
            </button>
            
            <button
              onClick={() => props.toggleListExpansion(listName)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label={props.expandedLists[listName] ? "收合清單" : "展開清單"}
            >
              {props.expandedLists[listName] ? 
                <ChevronUp size={20} /> : 
                <ChevronDown size={20} />
              }
            </button>
            
            {props.editingListName === listName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={props.editedName}
                  onChange={(e) => props.setEditedName(e.target.value)}
                  onKeyDown={props.handleEditKeyPress}
                  className="h-8"
                  autoFocus
                  maxLength={50}
                />
                <Button
                  size="sm"
                  onClick={props.saveEditedListName}
                  className="h-8"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    props.setEditingListName(null);
                    props.setEditedName('');
                  }}
                  className="h-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{listName}</h3>
                <span className="text-sm text-gray-600">
                  ({items.length} 項商品)
                </span>
                <button
                  onClick={() => props.startEditingList(listName)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => props.deleteList(listName)}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {props.expandedLists[listName] && (
          <div className="mt-4 space-y-4">
            {items.map((item, index) => props.renderProductCard(item, listName, index))}
          </div>
        )}
      </Card>
    </div>
  );
};
SortableListItem.displayName = 'SortableListItem';

// 主組件
export const ListManager = ({ username = '未登入使用者' }) => {
  const { savedLists, setSavedLists } = useList();
  const [newListName, setNewListName] = useState("");
  const [expandedLists, setExpandedLists] = useState({});
  const [expandedVariants, setExpandedVariants] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingListName, setEditingListName] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [selectedVariantInfo, setSelectedVariantInfo] = useState(null);
  const [storageInfo, setStorageInfo] = useState({
    total: 50 * 1024 * 1024,
    used: 0,
    lists: 0
  });
  // 列表順序狀態
  const [listOrder, setListOrder] = useState([]);

  // 拖放感應器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖曳開始前的最小距離
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 更新列表順序
  useEffect(() => {
    const currentListNames = Object.keys(savedLists);
    
    // 保留仍然存在的清單的現有順序
    const existingOrderedLists = listOrder.filter(name => currentListNames.includes(name));
    
    // 新增任何不在目前順序中的新列表
    const newLists = currentListNames.filter(name => !listOrder.includes(name));
    
    setListOrder([...existingOrderedLists, ...newLists]);
  }, [savedLists]);

  // 處理拖曳結束事件
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setListOrder(items => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        
        const newOrder = [...items];
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, active.id);
        
        return newOrder;
      });
    }
  }, []);

  // 防止預設行為的處理函數
  const preventDefaultActions = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  // 優化後的滾動處理
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    if (scrollTop > 0 && isSearchExpanded) {
      setIsSearchExpanded(false);
    }
  }, [isSearchExpanded]);

  // 優化的模態框滾動控制
  useEffect(() => {
    if (isModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;

      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = '0px';
      };
    }
  }, [isModalOpen]);

  // 切換搜尋區域展開/收合
  const toggleSearchExpanded = useCallback(() => {
    setIsSearchExpanded(prev => !prev);
  }, []);

  // 開始編輯清單名稱
  const startEditingList = useCallback((listName) => {
    setEditingListName(listName);
    setEditedName(listName);
  }, []);

  // 保存編輯後的清單名稱
  const saveEditedListName = useCallback(() => {
    if (editedName.trim() && editedName !== editingListName) {
      setSavedLists(prev => {
        const newLists = { ...prev };
        newLists[editedName.trim()] = newLists[editingListName];
        delete newLists[editingListName];
        return newLists;
      });
      
      // 更新列表順序以在重命名後保持相同的位置
      setListOrder(prev => {
        return prev.map(name => name === editingListName ? editedName.trim() : name);
      });
    }
    setEditingListName(null);
    setEditedName('');
  }, [editedName, editingListName, setSavedLists]);

  // 處理編輯時的鍵盤事件
  const handleEditKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      saveEditedListName();
    } else if (e.key === 'Escape') {
      setEditingListName(null);
      setEditedName('');
    }
  }, [saveEditedListName]);

  // 取得所有可用的品項類別，使用 useMemo 緩存
  const categories = useMemo(() => {
    const categorySet = new Set();
    Object.values(savedLists).forEach(items => {
      items.forEach(item => {
        if (item?.fields?.['品項']) {
          const categoryValues = item.fields['品項'].toString().split(/[,;，；]\s*/);
          categoryValues.forEach(category => {
            const trimmed = category.trim();
            if (trimmed) {
              categorySet.add(trimmed);
            }
          });
        }
      });
    });
    return Array.from(categorySet).sort();
  }, [savedLists]);

  // 圖片處理邏輯
  useEffect(() => {
    const processNewItems = async () => {
      let needsUpdate = false;
      const updatedLists = { ...savedLists };
  
      for (const [listName, items] of Object.entries(savedLists)) {
        for (const item of items) {
          if (item.colorVariants) {
            for (const variant of item.colorVariants) {
              if (variant.originalImageUrl && !variant.processedImage) {
                needsUpdate = true;
                const processedImage = await processImage(variant.originalImageUrl);
                if (processedImage) {
                  variant.processedImage = processedImage;
                  variant.variantImage = await createVariant(processedImage, variant.colors);
                  delete variant.originalImageUrl;
                }
              }
            }
          }
        }
      }
  
      if (needsUpdate) {
        setSavedLists(updatedLists);
      }
    };
  
    processNewItems();
  }, [savedLists, setSavedLists]);

  // 顏色選擇器相關操作
  const handleOpenColorPicker = useCallback((listName, productId, variantIndex) => {
    const product = savedLists[listName]?.find(item => item.id === productId);
    const variant = product?.colorVariants?.[variantIndex];
    
    if (variant) {
      setSelectedVariantInfo({
        listName,
        productId,
        variantIndex,
        variantImage: variant.variantImage || variant.processedImage
      });
      setIsColorPickerOpen(true);
    }
  }, [savedLists]);
  
  const handleColorSelect = useCallback(async (color, listName, productId, variantIndex) => {
    setSavedLists(prev => ({
      ...prev,
      [listName]: prev[listName].map(item => {
        if (item.id === productId) {
          const newVariants = [...(item.colorVariants || [])];
          if (newVariants[variantIndex]) {
            newVariants[variantIndex] = {
              ...newVariants[variantIndex],
              colors: color,
              timestamp: new Date().toISOString(),
              variantImage: newVariants[variantIndex].variantImage,
              processedImage: newVariants[variantIndex].processedImage
            };
          }
          return {
            ...item,
            colorVariants: newVariants
          };
        }
        return item;
      })
    }));
  }, [setSavedLists]);

  // 更新儲存空間狀態
  const updateStorageInfo = useCallback(async () => {
    const estimate = await getStorageEstimate();
    const listsSize = calculateObjectSize(savedLists);
    
    updateStorageUsage(listsSize);
    
    setStorageInfo({
      total: estimate.quota,
      used: estimate.usage,
      lists: listsSize
    });
  }, [savedLists]);

  useEffect(() => {
    updateStorageInfo();
  }, [savedLists, updateStorageInfo]);

  // 清單操作函數
  const createNewList = useCallback(() => {
    if (newListName.trim() && !savedLists[newListName.trim()]) {
      setSavedLists(prev => ({
        ...prev,
        [newListName.trim()]: []
      }));
      
      // 將新清單新增至訂單中
      setListOrder(prev => [...prev, newListName.trim()]);
      setNewListName("");
    }
  }, [newListName, savedLists, setSavedLists]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && newListName.trim()) {
      createNewList();
    }
  }, [createNewList, newListName]);

  const deleteList = useCallback((listName) => {
    if (window.confirm(`確定要刪除「${listName}」清單嗎？這將移除所有項目。`)) {
      setSavedLists(prev => {
        const newLists = { ...prev };
        delete newLists[listName];
        return newLists;
      });
      
      // 從列表順序中刪除
      setListOrder(prev => prev.filter(name => name !== listName));
    }
  }, [setSavedLists]);

  const removeFromList = useCallback((listName, productId) => {
    setSavedLists(prev => ({
      ...prev,
      [listName]: prev[listName].filter(item => item.id !== productId)
    }));
  }, [setSavedLists]);

  const toggleListExpansion = useCallback((listName) => {
    setExpandedLists(prev => ({
      ...prev,
      [listName]: !prev[listName]
    }));
  }, []);

  const toggleVariantsExpansion = useCallback((listName, itemId) => {
    setExpandedVariants(prev => ({
      ...prev,
      [`${listName}-${itemId}`]: !prev[`${listName}-${itemId}`]
    }));
  }, []);

  // 刪除顏色變體
  const removeColorVariant = useCallback(async (listName, productId, variantIndex) => {
    try {
      // 1. 先刪除要移除的變體的色票
      await deleteColorsByVariant(listName, productId, variantIndex);
      
      // 2. 更新後續變體的色票索引
      await updateColorVariantIndices(listName, productId, variantIndex + 1);
      
      // 3. 更新清單：如果是最後一個變體，則移除整個商品
      setSavedLists(prev => {
        const updatedList = prev[listName].map(item => {
          if (item.id === productId) {
            const newVariants = [...(item.colorVariants || [])];
            newVariants.splice(variantIndex, 1);
            
            // 如果沒有剩餘的變體，返回 null（稍後會被過濾掉）
            if (newVariants.length === 0) {
              return null;
            }
            
            return {
              ...item,
              colorVariants: newVariants
            };
          }
          return item;
        }).filter(Boolean); // 過濾掉 null 項目

        // 返回更新後的清單
        return {
          ...prev,
          [listName]: updatedList
        };
      });
    } catch (error) {
      console.error('Error removing color variant:', error);
    }
  }, [setSavedLists]);

  // 渲染商品卡片 - 使用 useCallback 緩存
  const renderProductCard = useCallback((item, listName, index) => {
    return (
      <ProductItemCard 
        key={`${item.id}-${index}`}
        item={item}
        listName={listName}
        index={index}
        preventDefaultActions={preventDefaultActions}
        removeFromList={removeFromList}
        setSavedLists={setSavedLists}
        username={username}
        expandedVariants={expandedVariants}
        toggleVariantsExpansion={toggleVariantsExpansion}
        handleOpenColorPicker={handleOpenColorPicker}
        removeColorVariant={removeColorVariant}
      />
    );
  }, [
    expandedVariants, 
    handleOpenColorPicker, 
    preventDefaultActions, 
    removeColorVariant, 
    removeFromList, 
    setSavedLists, 
    toggleVariantsExpansion, 
    username
  ]);

  // 過濾清單 - 使用 useMemo 緩存計算結果
  const filteredLists = useMemo(() => {
    if (!searchTerm?.trim() && (!selectedCategory || selectedCategory === 'all')) {
      return savedLists;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const filtered = {};
    
    Object.entries(savedLists).forEach(([listName, items]) => {
      const matchedItems = items.filter(item => {
        const productId = item?.fields?.['美工圖編號']?.toString() || '';
        const productName = item?.fields?.['美工圖名稱']?.toString() || '';
        const product = item?.fields?.['產品特色1']?.toString() || '';
        const productCategory = item?.fields?.['品項']?.toString() || '';
        const designer = item?.fields?.['設計者1']?.toString() || '';
        
        const matchesSearch = !searchTerm || 
          productId.toLowerCase().includes(searchLower) ||
          productName.toLowerCase().includes(searchLower) ||
          product.toLowerCase().includes(searchLower) ||
          designer.toLowerCase().includes(searchLower);
          
        const matchesCategory = selectedCategory === 'all' || 
          (productCategory && productCategory.toString().split(/[,;，；]\s*/)
            .some(cat => cat.trim() === selectedCategory));
        
        return matchesSearch && matchesCategory;
      });
      
      if (matchedItems.length > 0) {
        filtered[listName] = matchedItems;
      }
    });
    return filtered;
  }, [savedLists, searchTerm, selectedCategory]);

  // 計算過濾後的項目總數
  const filteredItemsCount = useMemo(() => {
    return Object.values(filteredLists).reduce((acc, curr) => acc + curr.length, 0);
  }, [filteredLists]);

  // 儲存清單順序到 localStorage
  useEffect(() => {
    if (listOrder.length > 0) {
      try {
        localStorage.setItem('listOrder', JSON.stringify(listOrder));
      } catch (error) {
        console.error('Error saving list order:', error);
      }
    }
  }, [listOrder]);

  // 從 localStorage 載入清單順序
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem('listOrder');
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        // 只使用目前存在的清單名稱
        const validLists = parsedOrder.filter(name => savedLists[name]);
        // 加入新的清單
        const newLists = Object.keys(savedLists).filter(name => !parsedOrder.includes(name));
        setListOrder([...validLists, ...newLists]);
      } else {
        setListOrder(Object.keys(savedLists));
      }
    } catch (error) {
      console.error('Error loading list order:', error);
      setListOrder(Object.keys(savedLists));
    }
  }, []);
  return (
    <>
      <Button 
        variant="outline" 
        className="gap-2"
        onClick={() => setIsModalOpen(true)}
      >
        <Save className="w-5 h-5" />
      </Button>
  
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div 
            className="relative bg-white rounded-lg w-full max-w-4xl mx-4 h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 標題區域 */}
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div>
                <h2 className="text-xl font-bold">已儲存的清單</h2>
                <p className="text-sm text-gray-500 mt-1">
                  共 {Object.keys(savedLists).length} 個清單，
                  {Object.values(savedLists).reduce((acc, curr) => acc + curr.length, 0)} 個項目
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* 搜尋區域 */}
            <SearchArea 
              isExpanded={isSearchExpanded}
              toggleExpanded={toggleSearchExpanded}
              newListName={newListName}
              setNewListName={setNewListName}
              createNewList={createNewList}
              handleKeyPress={handleKeyPress}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
              filteredItemsCount={filteredItemsCount}
            />
  
            {/* 可滾動的內容區域 */}
            <div 
              className="overflow-y-auto flex-1 scroll-smooth"
              style={{ scrollPaddingTop: '1rem' }}
              onScroll={handleScroll}
            >
              <div className="px-6 py-4 space-y-4">
                {Object.keys(filteredLists).length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchTerm.trim() ? '沒有符合搜尋條件的商品' : '尚未建立任何清單'}
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                  >
                    <SortableContext 
                      items={listOrder.filter(listName => filteredLists[listName])}
                      strategy={verticalListSortingStrategy}
                    >
                      {listOrder
                        .filter(listName => filteredLists[listName]) // 僅包含符合過濾器的列表
                        .map(listName => (
                          <SortableListItem
                            key={listName}
                            listName={listName}
                            items={filteredLists[listName]}
                            expandedLists={expandedLists}
                            toggleListExpansion={toggleListExpansion}
                            editingListName={editingListName}
                            editedName={editedName}
                            setEditedName={setEditedName}
                            handleEditKeyPress={handleEditKeyPress}
                            saveEditedListName={saveEditedListName}
                            setEditingListName={setEditingListName}
                            startEditingList={startEditingList}
                            deleteList={deleteList}
                            renderProductCard={renderProductCard}
                          />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
  
            {/* 儲存空間資訊 */}
            <StorageInfo storageInfo={storageInfo} />
          </div>
        </div>
      )}
  
      {/* 顏色選擇器 Modal */}
      {isColorPickerOpen && selectedVariantInfo && (
        <ColorPickerModal
          isOpen={isColorPickerOpen}
          onClose={() => setIsColorPickerOpen(false)}
          onColorSelect={handleColorSelect}
          selectedVariant={selectedVariantInfo.variantIndex}
          listName={selectedVariantInfo.listName}
          productId={selectedVariantInfo.productId}
          variantImage={selectedVariantInfo.variantImage}
          user={{ username: username }}
        />
      )}
    </>
  );
};

ListManager.displayName = 'ListManager';

export default ListManager;