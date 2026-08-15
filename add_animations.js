const fs = require('fs');

const file = 'd:/imran/new/frontend/src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update animation physics
content = content.replace(
  `const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};`,
  `const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20, mass: 1 } }
};`
);

content = content.replace(
  `const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6 } }
};`,
  `const fadeScale = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20, mass: 1 } }
};`
);

content = content.replace(
  `const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7 } }
};`,
  `const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 70, damping: 20 } }
};`
);

content = content.replace(
  `const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7 } }
};`,
  `const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 70, damping: 20 } }
};`
);

// Advanced hovers for Bento Grid Large
content = content.replace(
  `whileHover={{ y: -8, boxShadow: \`0 20px 40px \${C.primary}26\` }}`,
  `whileHover={{ y: -12, scale: 1.01, boxShadow: \`0 24px 48px \${C.primary}33\` }} transition={{ type: "spring", stiffness: 300, damping: 20 }}`
);

// Advanced hovers for Bento Grid Medium 1
content = content.replace(
  `whileHover={{ y: -8, boxShadow: \`0 20px 40px \${C.secondaryContainer}26\` }}`,
  `whileHover={{ y: -12, scale: 1.02, boxShadow: \`0 24px 48px \${C.secondaryContainer}33\` }} transition={{ type: "spring", stiffness: 300, damping: 20 }}`
);

// Advanced hovers for Bento Grid Medium 2
content = content.replace(
  `whileHover={{ y: -8, boxShadow: \`0 20px 40px \${C.tertiaryContainer}26\` }}`,
  `whileHover={{ y: -12, scale: 1.02, boxShadow: \`0 24px 48px \${C.tertiaryContainer}33\` }} transition={{ type: "spring", stiffness: 300, damping: 20 }}`
);

// Advanced hovers for Bento Grid Small (3 of them)
content = content.replace(
  /whileHover={{ y: -4, scale: 1.02 }} sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3.5, border: `1px solid \${C.outlineVariant}4D`, boxShadow: "0 2px 4px rgba\(0,0,0,0.02\)", height: "100%" }}/g,
  `whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} sx={{ bgcolor: C.surface, borderRadius: "24px", p: 3.5, border: \`1px solid \${C.outlineVariant}4D\`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)", height: "100%", transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: "0 16px 32px rgba(0,0,0,0.08)" } }}`
);

// Pricing Hover adjustments (already somewhat done but let's make sure they are dynamic)
// Actually we didn't do the pricing hover update yet because it was reverted. Let's do it here.
content = content.replace(
  `whileHover={{ y: -8 }} 
                              sx={isPopular 
                                ? { bgcolor: C.primary, color: C.onPrimary, borderRadius: "32px", p: 4, boxShadow: \`0 24px 60px \${C.primary}4D\`, display: "flex", flexDirection: "column", height: "100%", position: "relative", transform: { md: "translateY(-16px)" } }
                                : { bgcolor: C.surface, borderRadius: "32px", p: 4, border: \`1px solid \${C.outlineVariant}4D\`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", height: "100%" }`,
  `whileHover={{ y: -16, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              sx={isPopular 
                                ? { bgcolor: C.primary, color: C.onPrimary, borderRadius: "32px", p: 4, boxShadow: \`0 24px 60px \${C.primary}4D\`, display: "flex", flexDirection: "column", height: "100%", position: "relative", transform: { md: "translateY(-16px)" }, transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: \`0 32px 80px \${C.primary}80\` } }
                                : { bgcolor: C.surface, borderRadius: "32px", p: 4, border: \`1px solid \${C.outlineVariant}4D\`, boxShadow: "0 10px 40px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", height: "100%", transition: "box-shadow 0.3s ease", "&:hover": { boxShadow: "0 20px 60px rgba(0,0,0,0.08)" } }`
);

// Advanced hovers for Problem/Solution list items
content = content.replace(
  /whileHover={{ x: 10 }}/g,
  `whileHover={{ x: 12, scale: 1.02 }}`
);

// Adding a pulse effect to the Hero shapes
content = content.replace(
  `scale: [1, 1.2, 1],`,
  `scale: [1, 1.3, 1], rotate: [0, 90, 0],`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Animations updated!');
