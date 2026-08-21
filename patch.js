const fs = require('fs');
let c = fs.readFileSync('frontend/src/lib/i18n.ts', 'utf8');
c = c.replace('sales_status_cancelled: "CANCELLED",', 'sales_status_cancelled: "CANCELLED",\n    sales_status_returned: "RETURNED",');
c = c.replace('sales_status_cancelled: "?????",', 'sales_status_cancelled: "?????",\n    sales_status_returned: "???????",');
fs.writeFileSync('frontend/src/lib/i18n.ts', c, 'utf8');
