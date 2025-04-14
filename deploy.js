// deploy.js - GitHub Pages 部署脚本
const ghpages = require('gh-pages');
const path = require('path');

// 使用 import() 动态导入 chalk
(async function() {
  // 动态导入 chalk
  const chalkModule = await import('chalk');
  const chalk = chalkModule.default;
  
  // 读取 package.json 中的 homepage
  const pkg = require('./package.json');
  const homepage = pkg.homepage;

  if (!homepage) {
    console.error(chalk.red('Error: "homepage" 字段未在 package.json 中设置'));
    console.log(chalk.yellow('请在 package.json 中添加类似以下的配置:'));
    console.log(chalk.yellow('  "homepage": "https://用户名.github.io/仓库名"'));
    process.exit(1);
  }

  console.log(chalk.blue('开始部署到 GitHub Pages...'));
  console.log(chalk.blue(`目标地址: ${homepage}`));

  // 部署选项
  const options = {
    branch: 'gh-pages',
    repo: pkg.repository ? pkg.repository.url : undefined,
    message: '通过 deploy.js 自动部署 [ci skip]',
    dotfiles: true
  };

  // 开始部署
  ghpages.publish(path.join(__dirname, 'build'), options, function(err) {
    if (err) {
      console.error(chalk.red('部署失败:'), err);
      process.exit(1);
    } else {
      console.log(chalk.green('✓ 部署成功!'));
      console.log(chalk.green(`您的网站应该很快就可以在以下地址访问:`));
      console.log(chalk.green(homepage));
      console.log(chalk.blue('注意: GitHub Pages 可能需要几分钟时间来更新。'));
    }
  });
})();