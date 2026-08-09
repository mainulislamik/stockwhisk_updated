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
    if (!content.includes('react-hot-toast')) continue;
    
    // Check if it's not at the top (within first 500 chars roughly, or just find it)
    const lines = content.split('\n');
    let toastLineIndex = -1;
    for(let i=0; i<lines.length; i++) {
        if(lines[i].includes('import toast from "react-hot-toast"')) {
            toastLineIndex = i;
            break;
        }
    }
    
    // If the import is after line 20, it's definitely misplaced
    if (toastLineIndex > 20) {
        console.log('Fixing misplaced import in', file, 'at line', toastLineIndex);
        lines.splice(toastLineIndex, 1); // remove the line
        // insert at line 1 (after "use client" if it exists, or line 0)
        if(lines[0].includes('use client')) {
            lines.splice(1, 0, 'import toast from "react-hot-toast";');
        } else {
            lines.splice(0, 0, 'import toast from "react-hot-toast";');
        }
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        count++;
    }
}

console.log('Fixed imports in ' + count + ' files');
