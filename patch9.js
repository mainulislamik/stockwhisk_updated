const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/customers/[id]/page.tsx', 'utf8');
c = c.replace(/\\n/g, '\n');
fs.writeFileSync('frontend/src/app/app/customers/[id]/page.tsx', c, 'utf8');
