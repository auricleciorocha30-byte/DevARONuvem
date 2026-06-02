import fs from 'fs';
let code = fs.readFileSync('worker.js', 'utf-8');

const statusCode = `
    // MERCADO PAGO PIX CHECK STATUS
    if (url.pathname.startsWith("/api/mercado-pago/payment-status/") && request.method === "GET") {
      try {
        const id = url.pathname.split("/").pop();
        const accessToken = url.searchParams.get("accessToken");

        if (!accessToken) return new Response(JSON.stringify({ error: 'Access Token não fornecido.' }), { status: 400, headers: corsHeaders });

        const resp = await fetch(\`https://api.mercadopago.com/v1/payments/\${id}\`, { 
           headers: { 'Authorization': \`Bearer \${accessToken}\` } 
        });
        const data = await resp.json();
        
        return new Response(JSON.stringify(data), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro ao consultar status.' }), { status: 500, headers: corsHeaders });
      }
    }
`;

if (!code.includes('/api/mercado-pago/payment-status/')) {
    code = code.replace('// MERCADO PAGO CREATE PIX', statusCode + '\n    // MERCADO PAGO CREATE PIX');
    fs.writeFileSync('worker.js', code);
    console.log('Patched worker.js');
} else {
    console.log('Already in worker.js');
}
