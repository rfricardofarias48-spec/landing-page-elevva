const fs = require('fs');
const path = require('path');
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/132,204,22/g, '101,163,13');
  content = content.replace(/204,243,0/g, '132,204,22');
  fs.writeFileSync(filePath, content);
}
function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  });
}
walkDir('src');
console.log('Done');
