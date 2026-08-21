const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/app/customers/[id]/page.tsx', 'utf8');
c = c.replace(/?/g, '??');
c = c.replace(/?//g, '??');
c = c.replace(/??/g, '??');
c = c.replace(/??/g, '??');
fs.writeFileSync('frontend/src/app/app/customers/[id]/page.tsx', c, 'utf8');
