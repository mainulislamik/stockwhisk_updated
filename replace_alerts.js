const fs = require('fs');
const path = require('path');

const frontendSrc = path.join('frontend', 'src');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walkDir(frontendSrc);
let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('alert(')) continue;
    
    // add import if not there
    if (!content.includes('react-hot-toast')) {
        const lastImportIndex = content.lastIndexOf('import ');
        if (lastImportIndex !== -1) {
            const endOfLine = content.indexOf('\n', lastImportIndex);
            content = content.slice(0, endOfLine + 1) + 'import toast from "react-hot-toast";\n' + content.slice(endOfLine + 1);
        } else {
            content = 'import toast from "react-hot-toast";\n' + content;
        }
    }
    
    // replace alerts
    content = content.replace(/alert\(Owner/g, 'toast.success(Owner');
    content = content.replace(/alert\(Shop/g, 'toast.success(Shop');
    content = content.replace(/alert\(/g, 'toast.error(');
    
    fs.writeFileSync(file, content, 'utf8');
    count++;
}

console.log('Replaced alerts in ' + count + ' files');
