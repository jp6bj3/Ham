// // frontend/src/services/resetService.js
// import { config, logger, isDevelopment } from '../config/config';
// import { hashPassword, generateResetCode, validatePassword } from '../utils/authUtils';

// class ResetService {
//   constructor() {
//     this.resetRequests = new Map();
//     this.loadUsers();
//   }

//   // 載入用戶數據
//   async loadUsers() {
//     try {
//       let response;
//       if (isDevelopment()) {
//         response = await fetch(`${config.FILE_BASE_URL}/users.json`);
//       } else {
//         response = await fetch(`${config.API_BASE_URL}/public/get-users.php`);
//       }

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       this.users = await response.json();
//     } catch (error) {
//       logger.error('Failed to load users:', error);
//       this.users = { users: [] };
//     }
//   }

//   // 保存用戶數據
//   async saveUsers() {
//     try {
//       if (isDevelopment()) {
//         logger.debug('Development: Simulating save users', this.users);
//         localStorage.setItem('debug_users', JSON.stringify(this.users));
//         return true;
//       }

//       const response = await fetch(`${config.API_BASE_URL}/public/save-users.php`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(this.users)
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//     } catch (error) {
//       logger.error('Failed to save users:', error);
//       throw new Error('保存用戶數據失敗');
//     }
//   }

//   // 發送重置郵件 (使用簡化的郵件服務)
//   async sendResetEmail(username, resetCode) {
//     try {
//       const emailAddress = `${username}@${config.EMAIL_DOMAIN}`;
//       const subject = '密碼重置請求';
//       const content = `
//         您好,
        
//         我們收到了您的密碼重置請求。請使用以下重置碼來重置您的密碼：
        
//         重置碼: ${resetCode}
        
//         此重置碼將在30分鐘內有效。
//         如果這不是您發起的請求，請忽略此郵件。
        
//         謝謝,
//         系統管理團隊
//         (由 una.yang.shummi@gmail.com 發送)
//       `;

//       // 使用郵件服務發送
//       await mailService.sendMail(emailAddress, subject, content);
      
//       logger.debug('Reset email sent to:', emailAddress);
//       return true;
//     } catch (error) {
//       logger.error('Failed to send reset email:', error);
//       throw new Error('發送重置郵件失敗');
//     }
//   }

//   // 請求密碼重置
//   async requestReset(username, userIP) {
//     await this.loadUsers();
    
//     const user = this.users.users.find(u => u.username === username);
//     if (!user) {
//       throw new Error('用戶不存在');
//     }

//     const hasMatchingIP = user.ips.some(ip => ip.address === userIP);
//     if (!hasMatchingIP) {
//       throw new Error('無法驗證此IP地址');
//     }

//     const resetCode = generateResetCode();
//     const expiry = Date.now() + 30 * 60 * 1000; // 30分鐘有效期

//     this.resetRequests.set(username, {
//       resetCode,
//       expiry,
//       attempts: 0
//     });

//     await this.sendResetEmail(username, resetCode);

//     return true;
//   }

//   // 確認重置並更新密碼
//   async confirmReset(username, resetCode, newPassword) {
//     // 驗證密碼強度
//     const passwordValidation = validatePassword(newPassword);
//     if (!passwordValidation.isValid) {
//       throw new Error(passwordValidation.message);
//     }

//     const request = this.resetRequests.get(username);
//     if (!request) {
//       throw new Error('找不到重置請求');
//     }

//     if (Date.now() > request.expiry) {
//       this.resetRequests.delete(username);
//       throw new Error('重置碼已過期');
//     }

//     if (request.resetCode !== resetCode) {
//       request.attempts += 1;
//       if (request.attempts >= 3) {
//         this.resetRequests.delete(username);
//         throw new Error('重置碼錯誤次數過多，請重新申請');
//       }
//       throw new Error('重置碼錯誤');
//     }

//     await this.loadUsers();
    
//     const user = this.users.users.find(u => u.username === username);
//     if (!user) {
//       throw new Error('找不到用戶');
//     }

//     const hashedPassword = await hashPassword(newPassword);
//     user.passwordHash = hashedPassword;
    
//     // 清除所有 sessions
//     user.sessions = [];
    
//     // 重置登入嘗試計數
//     user.loginAttempts = {
//       count: 0,
//       lastAttempt: null,
//       lockUntil: null
//     };

//     await this.saveUsers();
//     this.resetRequests.delete(username);

//     return true;
//   }
// }

// export default new ResetService();