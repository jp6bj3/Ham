// deploy.js
require('dotenv').config();
const Client = require('ssh2-sftp-client');
const path = require('path');
const fs = require('fs');

async function attemptConnection(retries = 3) {
    const sftp = new Client();
    let attempt = 0;

    while (attempt < retries) {
        try {
            console.log(`\n嘗試連線中... (第 ${attempt + 1} 次)`);
            console.log('連線設定:');
            console.log(`主機: ${process.env.SFTP_HOST}`);
            console.log(`端口: ${process.env.SFTP_PORT || 80}`);  // 預設使用 80 端口
            console.log(`使用者: ${process.env.SFTP_USERNAME}`);
            
            await sftp.connect({
                host: process.env.SFTP_HOST,
                port: process.env.SFTP_PORT || 80,  // 預設使用 80 端口
                username: process.env.SFTP_USERNAME,
                password: process.env.SFTP_PASSWORD,
                readyTimeout: 20000,        // 增加超時時間到 20 秒
                reconnect: true,            // 啟用重連
                reconnectTries: 3,          // 重連次數
                reconnectDelay: 2000,       // 重連延遲
                debug: (text) => console.log(`DEBUG: ${text}`),
                algorithms: {
                    kex: [
                        'diffie-hellman-group1-sha1',
                        'diffie-hellman-group14-sha1',
                        'diffie-hellman-group14-sha256',
                        'diffie-hellman-group16-sha512',
                        'diffie-hellman-group18-sha512'
                    ],
                    cipher: [
                        'aes128-ctr',
                        'aes192-ctr',
                        'aes256-ctr',
                        'aes128-gcm',
                        'aes256-gcm'
                    ],
                    serverHostKey: [
                        'ssh-rsa',
                        'ssh-dss',
                        'ecdsa-sha2-nistp256',
                        'ecdsa-sha2-nistp384',
                        'ecdsa-sha2-nistp521'
                    ]
                }
            });

            console.log('連線成功！');
            return sftp;
        } catch (err) {
            console.error(`\n第 ${attempt + 1} 次連線失敗`);
            console.error('錯誤訊息:', err.message);
            
            if (attempt === retries - 1) {
                throw new Error(`連線失敗，已重試 ${retries} 次: ${err.message}`);
            }
            
            attempt++;
            const waitTime = attempt * 3000;
            console.log(`等待 ${waitTime/1000} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

async function deployToSFTP() {
    let sftp = null;
    
    try {
        console.log('開始部署流程...');
        
        // 檢查環境變數
        const requiredEnvVars = ['SFTP_HOST', 'SFTP_USERNAME', 'SFTP_PASSWORD', 'SFTP_REMOTE_PATH'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`);
        }

        // 檢查本地 build 目錄
        const buildPath = path.join(__dirname, 'build');
        if (!fs.existsSync(buildPath)) {
            throw new Error('找不到 build 目錄，請先執行 npm run build');
        }

        // 嘗試建立連線
        sftp = await attemptConnection();
        
        // 建立遠端目錄
        const remotePath = process.env.SFTP_REMOTE_PATH.replace(/\/$/, '');
        console.log(`\n準備上傳至: ${remotePath}`);
        
        try {
            await sftp.mkdir(remotePath, true);
            console.log('目標路徑已就緒');
        } catch (err) {
            console.error('建立目標路徑失敗:', err.message);
            throw err;
        }

        // 上傳檔案
        console.log('\n開始上傳檔案...');
        
        const files = fs.readdirSync(buildPath);
        for (const file of files) {
            const localPath = path.join(buildPath, file);
            const remotefile = `${remotePath}/${file}`;
            
            try {
                if (fs.statSync(localPath).isDirectory()) {
                    await sftp.uploadDir(localPath, remotefile);
                    console.log(`✓ 上傳目錄: ${file}`);
                } else {
                    await sftp.put(localPath, remotefile);
                    console.log(`✓ 上傳檔案: ${file}`);
                }
            } catch (err) {
                console.error(`上傳 ${file} 失敗:`, err.message);
                throw err;
            }
        }
        
        console.log('\n部署完成！');

    } catch (err) {
        console.error('\n部署失敗！');
        console.error('錯誤詳情:', err.message);
        process.exit(1);
    } finally {
        if (sftp) {
            try {
                await sftp.end();
            } catch (err) {
                console.error('關閉連線時發生錯誤:', err.message);
            }
        }
    }
}

deployToSFTP();