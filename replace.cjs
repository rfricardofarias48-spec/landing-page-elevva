const fs = require('fs');
const path = require('path');
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/#65a30d/g, '#4d7c0f');
  content = content.replace(/#84cc16/g, '#65a30d');
  content = content.replace(/#bce000/g, '#65a30d');
  content = content.replace(/#CCF300/g, '#84cc16');
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
