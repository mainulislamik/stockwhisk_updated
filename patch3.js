const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/dues/page.tsx', 'utf8');
if(!c.includes('import Link')) { c = c.replace('import { useState', 'import Link from " next/link\;\nimport { useState'); }
c = c.replace('<td className=\fw-medium\>{c.name}</td>', '<td className=\fw-medium\><Link href={/app/customers/} className=\text-decoration-none text-brand\>{c.name}</Link></td>');
fs.writeFileSync('frontend/src/app/app/dues/page.tsx', c, 'utf8');
