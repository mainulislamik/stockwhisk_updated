const fs = require('fs');
let c = fs.readFileSync('frontend/src/lib/i18n.ts', 'utf8');
c = c.replace('    sales_status_returned: " RETURNED\,\n sales_status_returned: \RETURNED\,', ' sales_status_returned: \RETURNED\,');
fs.writeFileSync('frontend/src/lib/i18n.ts', c, 'utf8');
