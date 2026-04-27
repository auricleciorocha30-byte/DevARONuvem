import fs from 'fs';
const files = [
  'pages/POS.tsx',
  'pages/MenuManagement.tsx',
  'pages/AdminDashboard.tsx',
  'pages/SuperAdminPanel.tsx',
  'pages/TVBoard.tsx',
  'pages/WeeklyOffers.tsx',
  'pages/StoreSettingsPage.tsx',
  'pages/DigitalMenu.tsx',
  'App.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  // Regex to match src={variable_or_expression} excluding templates with `.replace(/src=\{([^\}]+)\}/g`
  // Actually, specifically matching those empty string issues
  content = content.replace(/src=\{([^}]+)\}/g, (match, p1) => {
    if (p1.includes('|| undefined')) return match; // already done
    if (p1.includes('`')) return match; // template literal
    return `src={${p1} || undefined}`;
  });
  fs.writeFileSync(file, content);
}
console.log('done');
