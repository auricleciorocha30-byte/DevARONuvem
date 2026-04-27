import fs from 'fs';

const files = ['pages/OrdersList.tsx', 'pages/POS.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');

  // Replace text of the Consultar block to Consultar / Imprimir
  content = content.replace(
      />\s*CONSULTAR\s*<\/button>/g,
      '>CONSULTAR / IMPRIMIR</button>'
  );

  // In OrdersList.tsx, modify handleEmitNfce to use popup-friendly window.open
  content = content.replace(
    /setIsEmittingNfce\(group(?:.id)?\);\s*try/g,
    `const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up para o PDF. Emitindo mesmo assim...");
    }
    $&`
  );

  // In POS.tsx, modify handleEmitNfcePOS to use popup-friendly window.open
  content = content.replace(
    /setIsEmittingNfce\(true\);\s*try/g,
    `const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up. Emitindo mesmo assim...");
    }
    $&`
  );

  // Replace window.open with newWindow.location.href
  content = content.replace(
      /const danfeUrl = result\.caminho_danfe([^;]+);\s*if \(danfeUrl\) \{\s*const url = `https:\/\/\$\{settings\.focusNfeEnvironment === 'production' \? 'api' : 'homologacao'\}\.focusnfe\.com\.br\$\{danfeUrl\}`;\s*window\.open\(url, '_blank'\);\s*\}/g,
      `const danfeUrl = result.caminho_danfe$1;
        if (danfeUrl && newWindow) {
           const url = \`https://\${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br\${danfeUrl}\`;
           newWindow.location.href = url;
        } else if (danfeUrl) {
           const url = \`https://\${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br\${danfeUrl}\`;
           window.open(url, '_blank');
        } else if(newWindow) {
           newWindow.close();
        }`
  );

  // Catch the block when error
  content = content.replace(
      /\} catch \(([^)]+)\) \{\s*console\.error/g,
      `} catch ($1) {
      if (typeof newWindow !== 'undefined' && newWindow) newWindow.close();
      console.error`
  );
  
  content = content.replace(
      /\} else \{\s*console\.error\("Erro Focus NFe/g,
      `} else {
        if (typeof newWindow !== 'undefined' && newWindow) newWindow.close();
        console.error("Erro Focus NFe`
  );

  fs.writeFileSync(file, content);
}
console.log('done popup fix');
