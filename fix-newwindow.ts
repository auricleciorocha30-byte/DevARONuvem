import fs from 'fs';

let content = fs.readFileSync('pages/OrdersList.tsx', 'utf-8');
content = content.replace(/setIsEmittingNfce\(group\.id\);\s*const reference = `order_\$\{group\.id\}_\$\{Date\.now\(\)\}`;/g, `const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up para o PDF. Emitindo mesmo assim...");
    }
    setIsEmittingNfce(group.id);
    const reference = \`order_\${group.id}_\${Date.now()}\`;`);
fs.writeFileSync('pages/OrdersList.tsx', content);

let contentPOS = fs.readFileSync('pages/POS.tsx', 'utf-8');
contentPOS = contentPOS.replace(/setIsEmittingNfce\(true\);\s*const reference = `order_\$\{order\.id\}_\$\{Date\.now\(\)\}`;/g, `const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up para o PDF. Emitindo mesmo assim...");
    }
    setIsEmittingNfce(true);
    const reference = \`order_\${order.id}_\${Date.now()}\`;`);
fs.writeFileSync('pages/POS.tsx', contentPOS);

console.log('done window fix');
