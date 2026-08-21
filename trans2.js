const fs = require('fs');
let c = fs.readFileSync('mobile_app/src/screens/DashboardScreen.tsx', 'utf8');

c = c.replace(/\} সেলস/g, "} {language === 'BN' ? 'সেলস' : 'Sales'}");
c = c.replace(/\} মোট অর্ডার/g, "} {language === 'BN' ? 'মোট অর্ডার' : 'Total Orders'}");
c = c.replace(/\} মোট লাভ/g, "} {language === 'BN' ? 'মোট লাভ' : 'Total Profit'}");
c = c.replace(/\} প্রফিট মার্জিন/g, "} {language === 'BN' ? 'প্রফিট মার্জিন' : 'Profit Margin'}");

fs.writeFileSync('mobile_app/src/screens/DashboardScreen.tsx', c, 'utf8');
