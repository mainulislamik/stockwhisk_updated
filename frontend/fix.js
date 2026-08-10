const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Check if "use client"; is pushed down
    const useClientRegex = /^import \{ confirmAction, showError, showSuccess, showInfo \} from "@\/lib\/dialogs";\n"use client";\n/;
    if (useClientRegex.test(content)) {
        content = content.replace(useClientRegex, `"use client";\n\nimport { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";\n`);
        changed = true;
    }
    
    // Sometimes it might just be "use client"; without \n\n
    if (content.startsWith('import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";\n"use client";')) {
         content = content.replace('import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";\n"use client";', '"use client";\nimport { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";');
         changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed ${file}`);
    }
});
