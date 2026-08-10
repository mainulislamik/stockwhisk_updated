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

    // Check for window.confirm or confirm or alert
    if (content.match(/\b(window\.)?(confirm|alert)\(/)) {
        if (!content.includes('confirmAction')) {
            content = `import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";\n` + content;
            changed = true;
        }

        let oldContent = content;
        content = content.replace(/if \(!confirm\((.*?)\)\) return;/g, 'if (!(await confirmAction($1))) return;');
        content = content.replace(/if \(!window\.confirm\((.*?)\)\) return;/g, 'if (!(await confirmAction($1))) return;');
        content = content.replace(/return alert\((.*?)\)/g, 'return (await showInfo($1))');
        content = content.replace(/alert\((.*?)\)/g, '(await showInfo($1))');

        if (content !== oldContent) {
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
