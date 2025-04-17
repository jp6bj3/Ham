import { config, logger, isDevelopment } from '../config/config';
import { 
  hashPassword, 
  generateSessionToken, 
  validateLoginAttempts, 
  updateLoginAttempts,
  validatePassword 
} from '../utils/authUtils';

// 預設白名單設定 (全部轉換為小寫)
const DEFAULT_WHITELIST = [
  'admin',
  'carrie',
  'perkins.lin',
  'darling.cheng',
  'alex.yang',
  'james.wang',
  'joanne',
  'judy.kuo',
  'angel.lai',
  'angel.hsieh',
  'abby.chen',
  'ilona.lin',
  'jason.tseng',
  'nina.huang',
  'yvonne.wang',
  'iris.wang',
  'eileen.lu',
  'kawa.yu',
  'jessie',
  'iris.hsieh',
  'una.yang',
  'vincent.huang',
  'fengyu.wu',
  'jason.liu',
  'benson.huang',
  'aaa'
];

class AuthService {
  // 錯誤訊息處理
  getErrorMessage(error) {
    if (error.message.includes('Failed to fetch')) {
      return '無法連接到服務器，請檢查網絡連接';
    }
    return error.message || '操作失敗，請稍後重試';
  }

  constructor() {
    this.users = { users: [] };
    this.whitelist = [...DEFAULT_WHITELIST]; // 使用預設白名單的複本
    
    // 延遲初始化，避免循環依賴問題
    setTimeout(() => {
      this.init();
    }, 0);
  }

  async init() {
    try {
      await Promise.all([
        this.loadUsers(),
        this.loadWhitelist()
      ]);
    } catch (error) {
      logger.error('Service initialization failed:', error);
    }
  }

  // API 請求基礎方法
  async makeApiRequest(endpoint, options = {}) {
    if (isDevelopment()) {
      // 本地開發模式下模擬 API 延遲
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.handleLocalRequest(endpoint, options);
    }

    const url = `${config.API_BASE_URL}/public/${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.error(`API request failed (${endpoint}):`, error);
      throw new Error(this.getErrorMessage(error));
    }
  }

 // 本地開發的請求處理
 async handleLocalRequest(endpoint, options) {
  logger.debug('Local request:', endpoint, options); // 添加日誌
  
  switch(endpoint) {
    case 'data/get-whitelist.php':
      return this.getLocalWhitelist();
    case 'data/save-whitelist.php':
      const whitelistData = typeof options.body === 'string' 
        ? JSON.parse(options.body) 
        : options.body;
      return this.saveLocalWhitelist(whitelistData);
    case 'data/get-users.php':
      return this.getLocalUsers();
    case 'data/save-users.php':
      const userData = typeof options.body === 'string' 
        ? JSON.parse(options.body) 
        : options.body;
      return this.saveLocalUsers(userData);
    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

// 本地數據處理方法
getLocalWhitelist() {
  try {
    const data = localStorage.getItem('debug_whitelist');
    if (!data) {
      const defaultData = { whitelist: [...DEFAULT_WHITELIST] };
      localStorage.setItem('debug_whitelist', JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to get local whitelist:', error);
    return { whitelist: [...DEFAULT_WHITELIST] };
  }
}

saveLocalWhitelist(data) {
  try {
    if (!data || !data.whitelist) {
      throw new Error('Invalid whitelist data structure');
    }
    
    // 確保所有項目轉為小寫
    data.whitelist = data.whitelist.map(item => item.toLowerCase());
    
    // 確保 admin 永遠在白名單中
    if (!data.whitelist.includes('admin')) {
      data.whitelist.push('admin');
    }
    
    localStorage.setItem('debug_whitelist', JSON.stringify(data));
    logger.debug('Whitelist saved locally:', data);
    return { success: true };
  } catch (error) {
    logger.error('Failed to save local whitelist:', error);
    throw new Error('保存白名單失敗: ' + error.message);
  }
}

  saveLocalUsers(data) {
    localStorage.setItem('debug_users', typeof data === 'string' ? data : JSON.stringify(data));
    return { success: true };
  }

  getLocalUsers() {
    const data = localStorage.getItem('debug_users');
    return data ? JSON.parse(data) : { users: [] };
  }

  // 使用者數據相關方法
  async loadUsers() {
    try {
      const data = await this.makeApiRequest('data/get-users.php');
      this.users = data;
      logger.debug('Users loaded:', this.users);
    } catch (error) {
      logger.error('Failed to load users:', error);
      this.users = { users: [] };
    }
  }

  async saveUsers() {
    try {
      await this.makeApiRequest('data/save-users.php', {
        method: 'POST',
        body: JSON.stringify(this.users)
      });
      return true;
    } catch (error) {
      logger.error('Failed to save users:', error);
      throw new Error('保存用戶數據失敗');
    }
  }

  // 白名單相關方法
  async loadWhitelist() {
    try {
      const data = await this.makeApiRequest('data/get-whitelist.php');
      
      // 確保所有白名單項目轉為小寫
      this.whitelist = data.whitelist.map(item => item.toLowerCase());
      
      logger.debug('Whitelist loaded:', this.whitelist);
    } catch (error) {
      logger.error('Failed to load whitelist:', error);
      this.whitelist = [...DEFAULT_WHITELIST];
    }
  }

  async saveWhitelist() {
    try {
      // 確保所有白名單項目轉為小寫
      const whitelistToSave = this.whitelist.map(item => item.toLowerCase());
      
      const result = await this.makeApiRequest('data/save-whitelist.php', {
        method: 'POST',
        body: JSON.stringify({ whitelist: whitelistToSave })
      });
      
      logger.debug('Whitelist saved:', whitelistToSave);
      return result;
    } catch (error) {
      logger.error('Failed to save whitelist:', error);
      throw new Error('保存白名單失敗: ' + error.message);
    }
  }

  async adminAddWhitelist(username) {
    try {
      if (!username) {
        throw new Error('用戶名不能為空');
      }

      // 轉小寫
      const lowercaseUsername = username.toLowerCase();

      // 先加載最新的白名單
      await this.loadWhitelist();
      
      if (this.whitelist.includes(lowercaseUsername)) {
        throw new Error('此用戶名已在白名單中');
      }

      // 更新白名單
      this.whitelist.push(lowercaseUsername);
      
      // 保存更新後的白名單
      const result = await this.saveWhitelist();
      
      if (result.success) {
        logger.debug('Added to whitelist successfully:', lowercaseUsername);
        return { success: true };
      } else {
        throw new Error('保存失敗');
      }
    } catch (error) {
      logger.error('Failed to add to whitelist:', error);
      throw new Error(error.message || '新增白名單失敗');
    }
  }

  // Session 相關方法
  createSession() {
    const token = generateSessionToken();
    const now = new Date();
    return {
      token,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // 用戶認證相關方法
  async login(username, password) {
    if (!username || !password) {
      throw new Error('請輸入帳號和密碼');
    }

    await this.loadUsers();
    await this.loadWhitelist();
    
    // 先不區分大小寫查找用戶
    let user = this.users.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      // 不區分大小寫檢查白名單
      if (!this.whitelist.includes(username.toLowerCase())) {
        throw new Error('此帳號不在允許註冊的白名單中');
      }
      return await this.registerNewUser(username, password);
    }

    return await this.loginExistingUser(user, password);
  }

  async registerNewUser(username, password) {
    try {
      // 添加密碼驗證
      const validation = validatePassword(password);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      const hashedPassword = await hashPassword(password);
      const user = {
        username,
        passwordHash: hashedPassword,
        loginAttempts: {
          count: 0,
          lastAttempt: null,
          lockUntil: null
        },
        sessions: []
      };

      this.users.users.push(user);
      await this.saveUsers();
      
      const session = this.createSession();
      user.sessions.push(session);
      await this.saveUsers();

      return { success: true, user, session };
    } catch (error) {
      logger.error('Failed to register user:', error);
      throw new Error(error.message || '註冊失敗');
    }
  }

  async loginExistingUser(user, password) {
    const loginStatus = validateLoginAttempts(user.loginAttempts);
    if (loginStatus.isLocked) {
      throw new Error(loginStatus.message);
    }

    try {
      const hashedPassword = await hashPassword(password);
      if (hashedPassword !== user.passwordHash) {
        user.loginAttempts = updateLoginAttempts(user.loginAttempts, false);
        await this.saveUsers();
        throw new Error(`登入失敗，還剩 ${loginStatus.remainingAttempts - 1} 次嘗試機會`);
      }

      user.loginAttempts = updateLoginAttempts(user.loginAttempts, true);
      const session = this.createSession();
      user.sessions.push(session);
      await this.saveUsers();

      return { success: true, user, session };
    } catch (error) {
      logger.error('Login error:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  // 管理員功能
  async getAdminData() {
    try {
      await Promise.all([this.loadUsers(), this.loadWhitelist()]);
      return {
        users: this.users.users,
        whitelist: this.whitelist
      };
    } catch (error) {
      logger.error('Failed to get admin data:', error);
      throw new Error('無法取得管理員資料');
    }
  }

  async adminCreateUser(username, password) {
    if (!username || !password) {
      throw new Error('用戶名和密碼不能為空');
    }

    // 不區分大小寫檢查用戶是否存在
    const existingUser = this.users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      throw new Error('用戶名已存在');
    }

    // 不區分大小寫檢查白名單
    if (!this.whitelist.includes(username.toLowerCase())) {
      throw new Error('此用戶名不在白名單中');
    }

    return await this.registerNewUser(username, password);
  }

  async adminDeleteUser(username) {
    if (username.toLowerCase() === 'admin') {
      throw new Error('無法刪除 admin 帳號');
    }

    // 不區分大小寫查找用戶
    const userIndex = this.users.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex === -1) {
      throw new Error('用戶不存在');
    }

    this.users.users.splice(userIndex, 1);
    await this.saveUsers();
    
    return { success: true };
  }

  async adminUpdateUserPassword(username, newPassword) {
    if (!username || !newPassword) {
      throw new Error('用戶名和新密碼不能為空');
    }

    // 不區分大小寫查找用戶
    const user = this.users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      throw new Error('用戶不存在');
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      throw new Error(validation.message);
    }

    user.passwordHash = await hashPassword(newPassword);
    user.loginAttempts = {
      count: 0,
      lastAttempt: null,
      lockUntil: null
    };

    await this.saveUsers();
    return { success: true };
  }

  async adminGetUserDetails(username) {
    // 不區分大小寫查找用戶
    const user = this.users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      throw new Error('用戶不存在');
    }

    const { passwordHash, ...safeUserData } = user;
    return safeUserData;
  }

  async adminGetSystemStatus() {
    await Promise.all([this.loadUsers(), this.loadWhitelist()]);
    
    return {
      totalUsers: this.users.users.length,
      activeUsers: this.users.users.filter(u => u.sessions.length > 0).length,
      whitelistCount: this.whitelist.length,
      lockedUsers: this.users.users.filter(u => 
        u.loginAttempts?.lockUntil && new Date(u.loginAttempts.lockUntil) > new Date()
      ).length
    };
  }

  async adminAddWhitelist(username) {
    try {
      if (!username) {
        throw new Error('用戶名不能為空');
      }

      // 轉為小寫
      const lowercaseUsername = username.toLowerCase();

      await this.loadWhitelist();
      if (this.whitelist.includes(lowercaseUsername)) {
        throw new Error('此用戶名已在白名單中');
      }

      this.whitelist.push(lowercaseUsername);
      await this.saveWhitelist();
      logger.debug('Added to whitelist:', lowercaseUsername);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to add to whitelist:', error);
      throw new Error(error.message || '新增白名單失敗');
    }
  }

  async adminDeleteWhitelist(username) {
    try {
      if (username.toLowerCase() === 'admin') {
        throw new Error('無法從白名單中移除 admin');
      }

      // 轉為小寫
      const lowercaseUsername = username.toLowerCase();

      await this.loadWhitelist();
      const index = this.whitelist.indexOf(lowercaseUsername);
      if (index === -1) {
        throw new Error('用戶名不在白名單中');
      }

      // 檢查是否有對應的活動用戶 (不區分大小寫)
      const activeUser = this.users.users.find(u => u.username.toLowerCase() === lowercaseUsername);
      if (activeUser) {
        throw new Error('此用戶仍在使用中，無法從白名單移除');
      }

      this.whitelist.splice(index, 1);
      await this.saveWhitelist();
      logger.debug('Removed from whitelist:', lowercaseUsername);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove from whitelist:', error);
      throw new Error(error.message || '從白名單移除失敗');
    }
  }

  //重新整理用戶異常狀態-登入錯誤限制15分鐘
  async adminResetLoginAttempts(username) {
    try {
      // 不區分大小寫查找用戶
      const user = this.users.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        throw new Error('用戶不存在');
      }
  
      // 重置登入嘗試
      user.loginAttempts = {
        count: 0,
        lastAttempt: null,
        lockUntil: null
      };
  
      await this.saveUsers();
      logger.debug('Reset login attempts for user:', username);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to reset login attempts:', error);
      throw new Error('重置登入嘗試失敗');
    }
  }
}

// 創建單例實例
const authService = new AuthService();

// 導出單例
export default authService;