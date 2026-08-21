const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/customers/[id]/page.tsx', 'utf8');
c = c.replace('(() => (h{ results: [] }));', '(() => ({ results: [] }));');
fs.writeFileSync('frontend/src/app/app/customers/[id]/page.tsx', c, 'utf8');
