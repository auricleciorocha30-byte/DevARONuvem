import fs from 'fs';

let content = fs.readFileSync('pages/MenuManagement.tsx', 'utf-8');

// The replacement needs to be careful.
const oldCode = `        setEditingProduct(prev => {
          if (!prev) return null;
          return {
            ...prev,
            name: prev.name || data.name,
            description: prev.description || data.description,
            ncm: prev.ncm || data.ncm,
            cfop: prev.cfop || '5102',
            icms_situacao_tributaria: prev.icms_situacao_tributaria || '102'
          };
        });`;

const newCode = `        setEditingProduct(prev => {
          if (!prev) return null;
          return {
            ...prev,
            name: prev.name || data.name,
            description: prev.description || data.description,
            ncm: prev.ncm || data.ncm,
            cfop: prev.cfop || '5102',
            icms_situacao_tributaria: prev.icms_situacao_tributaria || '102'
          };
        });
        alert("Dados do produto preenchidos via código de barras!");`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync('pages/MenuManagement.tsx', content);
    console.log("done fix-barcode");
} else {
    console.log("Could not find the exact oldCode string to replace.");
}
