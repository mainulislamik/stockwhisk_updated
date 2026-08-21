const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/customers/[id]/page.tsx', 'utf8');
c = c.replace('useParams<; id: string }>()', 'useParams<{ id: string }>()');
fs.writeFileSync('frontend/src/app/app/customers/[id]/page.tsx', c, 'utf8');
