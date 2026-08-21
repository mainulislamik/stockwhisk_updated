const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/customers/page.tsx', 'utf8');
if(!c.includes('import Link')) { c = c.replace('import React', 'import Link from " next/link\;\nimport React'); }
c = c.replace('<td className=\fw-medium\>{c.name}</td>', '<td className=\fw-medium\><Link href={/app/customers/} className=\text-decoration-none text-brand\>{c.name}</Link></td>');
fs.writeFileSync('frontend/src/app/app/customers/page.tsx', c, 'utf8');
