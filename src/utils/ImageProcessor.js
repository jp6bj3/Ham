export const processImage = async (imageUrl) => {
    try {
      // 載入圖片
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageUrl;
      });
  
      // 創建 canvas 並設置尺寸
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 300;
      const scale = MAX_WIDTH / img.naturalWidth;
      const width = MAX_WIDTH;
      const height = Math.round(img.naturalHeight * scale);
  
      canvas.width = width;
      canvas.height = height;
      
      // 繪製圖片
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // 返回壓縮後的圖片數據
      return canvas.toDataURL('image/png', 0.7);
    } catch (error) {
      console.error('Error processing image:', error);
      return null;
    }
  };
  
  export const createVariant = async (baseImageData, colors) => {
    try {
      const canvas = document.createElement('canvas');
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = baseImageData;
      });
  
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      ctx.filter = `hue-rotate(${colors.hue}deg) 
                   saturate(${colors.saturation}%) 
                   brightness(${colors.lightness}%)`;
      
      ctx.drawImage(img, 0, 0);
      
      return canvas.toDataURL('image/png', 0.6);
    } catch (error) {
      console.error('Error creating variant:', error);
      return null;
    }
  };
  