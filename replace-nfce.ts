import fs from 'fs';

const files = ['pages/OrdersList.tsx', 'pages/POS.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');

  // Replace caminho_xml_nota_fiscal with caminho_danfe
  content = content.replace(
      /if \(result\.caminho_xml_nota_fiscal\) \{\s*window\.open\([^)]+\);\s*\}/g,
      `const danfeUrl = result.caminho_danfe || result.caminho_xml_nota_fiscal;
        if (danfeUrl) {
           const url = \`https://\${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br\${danfeUrl}\`;
           window.open(url, '_blank');
        }`
  );
  
  fs.writeFileSync(file, content);
}
console.log('done');
