const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Nav.tsx', 'utf8');
c = c.replace('{(isOwner || can(" view_reports\)) && <Item href=\/app/reports\ icon=\bi-graph-up\ label={t(\nav_reports\)} />}', '');
const beforeFin = '{showFinance && (';
c = c.replace(beforeFin, {(isOwner || can(\view_reports\)) && <Item href=\/app/reports\ icon=\bi-graph-up\ label={t(\nav_reports\)} />}\n + beforeFin);
fs.writeFileSync('frontend/src/components/Nav.tsx', c, 'utf8');
