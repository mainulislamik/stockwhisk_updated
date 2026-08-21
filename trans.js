const fs = require('fs');

let content = fs.readFileSync('mobile_app/src/screens/DashboardScreen.tsx', 'utf8');

const replacements = {
    "'দৈনিক'": "(language === 'BN' ? 'দৈনিক' : 'Daily')",
    "'সাপ্তাহিক'": "(language === 'BN' ? 'সাপ্তাহিক' : 'Weekly')",
    "'মাসিক'": "(language === 'BN' ? 'মাসিক' : 'Monthly')",
    "'বাৎসরিক'": "(language === 'BN' ? 'বাৎসরিক' : 'Yearly')",
    "'লাইফটাইম'": "(language === 'BN' ? 'লাইফটাইম' : 'Lifetime')",
    "'আজকের'": "(language === 'BN' ? 'আজকের' : 'Today\\'s')",
    "'গত ৭ দিন'": "(language === 'BN' ? 'গত ৭ দিন' : 'Last 7 Days')",
    "'গত ৩০ দিন'": "(language === 'BN' ? 'গত ৩০ দিন' : 'Last 30 Days')",
    "'শুভ সকাল, '": "(language === 'BN' ? 'শুভ সকাল, ' : 'Good morning, ')",
    "শুভ সকাল, ": "{language === 'BN' ? 'শুভ সকাল, ' : 'Good morning, '}",
    "' সেলস'": "(language === 'BN' ? ' সেলস' : ' Sales')",
    "' মোট অর্ডার'": "(language === 'BN' ? ' মোট অর্ডার' : ' Total Orders')",
    "' মোট লাভ'": "(language === 'BN' ? ' মোট লাভ' : ' Total Profit')",
    "' প্রফিট মার্জিন'": "(language === 'BN' ? ' প্রফিট মার্জিন' : ' Profit Margin')",
    "'পরিমাণ: '": "(language === 'BN' ? 'পরিমাণ: ' : 'Qty: ')",
    "পরিমাণ: ": "{language === 'BN' ? 'পরিমাণ: ' : 'Qty: '}",
    "' টি'": "(language === 'BN' ? ' টি' : '')",
    " টি<": " {language === 'BN' ? 'টি' : ''}<",
    "'professional প্ল্যান'": "(language === 'BN' ? 'professional প্ল্যান' : 'Professional Plan')",
    'title="দৈনিক (Today)"': 'title={language === \\'BN\\' ? \\'দৈনিক (Today)\\' : \\'Daily\\'}',
    'title="সাপ্তাহিক (7 Days)"': 'title={language === \\'BN\\' ? \\'সাপ্তাহিক (7 Days)\\' : \\'Weekly\\'}',
    'title="মাসিক (30 Days)"': 'title={language === \\'BN\\' ? \\'মাসিক (30 Days)\\' : \\'Monthly\\'}',
    'title="বাৎসরিক (1 Year)"': 'title={language === \\'BN\\' ? \\'বাৎসরিক (1 Year)\\' : \\'Yearly\\'}',
    'title="লাইফটাইম (Lifetime)"': 'title={language === \\'BN\\' ? \\'লাইফটাইম (Lifetime)\\' : \\'Lifetime\\'}'
};

for (const [k, v] of Object.entries(replacements)) {
    content = content.split(k).join(v);
}

fs.writeFileSync('mobile_app/src/screens/DashboardScreen.tsx', content, 'utf8');
