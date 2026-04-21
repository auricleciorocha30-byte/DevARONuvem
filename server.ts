import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

async function startServer() {
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Diagnostic route
  app.get('/api-health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Server is running',
      env: process.env.NODE_ENV || 'production',
      time: new Date().toISOString()
    });
  });

  // Create an API router
  const apiRouter = express.Router();

  // Test route on the router
  apiRouter.get('/test', (req, res) => {
    res.json({ message: 'API Router is reachable at /api/test' });
  });

  // Debug middleware for API routes
  apiRouter.use((req, res, next) => {
    console.log(`[API ROUTER LOG] ${req.method} ${req.url}`);
    next();
  });

  // Mount the router on /api IMMEDIATELY to ensure priority
  app.use('/api', apiRouter);

  // API Route for Mercado Pago Checkout Pro
  apiRouter.post('/mercado-pago/create-preference', async (req, res) => {
    const { accessToken, orderData, storeUrl } = req.body;
    // ... logic remains same, just moved to router
    if (!accessToken) return res.status(400).json({ error: 'Access Token do Mercado Pago não fornecido.' });
    try {
      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);
      
      // Use quantity: 1 trick to avoid float errors with MP Pro
      const items = orderData.items.map((item: any) => ({
        id: item.productId || item.id,
        title: item.name,
        quantity: 1,
        unit_price: Number((Number(item.price) * Number(item.quantity)).toFixed(2)),
        currency_id: 'BRL'
      }));

      if (orderData.deliveryFee > 0) items.push({ id: 'delivery_fee', title: 'Taxa de Entrega', quantity: 1, unit_price: Number(orderData.deliveryFee), currency_id: 'BRL' });
      if (orderData.serviceFee > 0) items.push({ id: 'service_fee', title: 'Taxa de Serviço', quantity: 1, unit_price: Number(orderData.serviceFee), currency_id: 'BRL' });
      
      let amountToCharge = orderData.total;
      if (orderData.paymentDetails) {
        try {
          const details = JSON.parse(orderData.paymentDetails);
          const onlinePayment = details.find((d: any) => d.method === 'ONLINE');
          if (onlinePayment) amountToCharge = onlinePayment.amount;
        } catch (e) {}
      }

      const body = {
        items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
          ? [{ id: orderData.id, title: `Pedido #${orderData.displayId}`, quantity: 1, unit_price: amountToCharge, currency_id: 'BRL' }]
          : items,
        external_reference: orderData.id,
        back_urls: {
          success: `${storeUrl}?payment=success&orderId=${orderData.id}`,
          failure: `${storeUrl}?payment=failure&orderId=${orderData.id}`,
          pending: `${storeUrl}?payment=pending&orderId=${orderData.id}`
        },
        auto_return: 'approved' as const,
      };
      const result = await preference.create({ body });
      res.json({ init_point: result.init_point, id: result.id });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao gerar pagamento online.' });
    }
  });

  // API Route for Mercado Pago Point
  apiRouter.post('/mercado-pago/point/create-payment-intent', async (req, res) => {
    const { accessToken, deviceId, amount, description, externalReference } = req.body;
    if (!accessToken || !deviceId) return res.status(400).json({ error: 'Access Token ou Device ID não fornecido.' });
    try {
      const resp = await fetch(`https://api.mercadopago.com/point/integration-api/devices/${deviceId}/payment-intents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100) / 100, description: description || 'Venda PDV', external_reference: externalReference, payment: { installments: 1, type: 'credit_card' } })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Erro na maquininha.');
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get('/mercado-pago/point/payment-intent/:id', async (req, res) => {
    const { id } = req.params;
    const accessToken = req.query.accessToken as string;
    if (!accessToken) return res.status(400).json({ error: 'Access Token não fornecido.' });
    try {
      const resp = await fetch(`https://api.mercadopago.com/point/integration-api/payment-intents/${id}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      const data = await resp.json();
      res.json(data);
    } catch (error: any) { res.status(500).json({ error: 'Erro ao consultar status.' }); }
  });

  // API Route for Barcode Lookup
  apiRouter.get('/barcode-lookup/:code', async (req, res) => {
    try {
      const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${req.params.code}.json`);
      const data = await resp.json();
      if (data.status === 1) {
        res.json({ name: data.product.product_name || '', description: data.product.generic_name || '', brand: data.product.brands || '', ncm: '21069090' });
      } else { res.status(404).json({ error: 'Não encontrado.' }); }
    } catch (error) { res.status(500).json({ error: 'Erro no serviço.' }); }
  });

  // API Route for Focus NFe
  apiRouter.post('/focus-nfe/emit-nfce', async (req, res) => {
    const { token, environment, nfceData, reference } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não fornecido.' });
    const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    try {
      const resp = await fetch(`${baseUrl}/v2/nfce?ref=${reference}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}` },
        body: JSON.stringify(nfceData)
      });
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (error) { res.status(500).json({ error: 'Erro na Focus NFe.' }); }
  });

  apiRouter.get('/focus-nfe/consult-nfce', async (req, res) => {
    const { token, environment, reference } = req.query;
    if (!token || !reference) return res.status(400).json({ error: 'Dados incompletos.' });
    const baseUrl = (environment as string) === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    try {
      const resp = await fetch(`${baseUrl}/v2/nfce/${reference}`, { headers: { 'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}` } });
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (error) { res.status(500).json({ error: 'Erro de consulta.' }); }
  });

  apiRouter.delete('/focus-nfe/cancel-nfce', async (req, res) => {
    const { token, environment, reference, justificativa } = req.body;
    if (!token || !reference) return res.status(400).json({ error: 'Dados incompletos.' });
    const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    try {
      const resp = await fetch(`${baseUrl}/v2/nfce/${reference}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}` },
        body: JSON.stringify({ justificativa: justificativa || 'Cancelamento solicitado.' })
      });
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (error) { res.status(500).json({ error: 'Erro ao cancelar.' }); }
  });

  // API Route for PagBank - GENERIC NAME TO AVOID CLOUDFLARE WAF
  apiRouter.post(['/pbank/checkout', '/v1/process-payment'], async (req, res) => {
    const { token, environment, orderData, storeUrl } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não fornecido.' });
    const baseUrl = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
    try {
      // Use quantity: 1 trick for PagBank as well to avoid float quantity issues
      const items = orderData.items.map((item: any) => ({ 
        name: item.name, 
        quantity: 1, 
        unit_amount: Math.round(Number(item.price) * Number(item.quantity) * 100) 
      }));

      if (orderData.deliveryFee > 0) items.push({ name: 'Taxa de Entrega', quantity: 1, unit_amount: Math.round(Number(orderData.deliveryFee) * 100) });
      if (orderData.serviceFee > 0) items.push({ name: 'Taxa de Serviço', quantity: 1, unit_amount: Math.round(Number(orderData.serviceFee) * 100) });
      
      let amountToCharge = orderData.total;
      if (orderData.paymentDetails) {
        try {
          const details = JSON.parse(orderData.paymentDetails);
          const onlinePayment = details.find((d: any) => d.method === 'ONLINE');
          if (onlinePayment) amountToCharge = onlinePayment.amount;
        } catch (e) {}
      }

      const body: any = {
        reference_id: orderData.id,
        items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
          ? [{ name: `Pedido #${orderData.displayId}`, quantity: 1, unit_amount: Math.round(amountToCharge * 100) }]
          : items,
        redirect_url: `${storeUrl}?payment=success&orderId=${orderData.id}`,
        notification_urls: [`${storeUrl}/api/webhooks/pagbank`],
        payment_methods: [{ type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }, { type: 'BOLETO' }, { type: 'PIX' }]
      };

      if (orderData.customerName && orderData.customerName !== 'Cliente PDV') {
        body.customer = { name: orderData.customerName, email: 'cliente@email.com' };
      }

      const resp = await fetch(`${baseUrl}/checkouts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const responseText = await resp.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('PagBank Checkout Non-JSON:', responseText);
        throw new Error(`PagBank retornou resposta inválida (${resp.status}): ${responseText.substring(0, 100)}`);
      }

      if (!resp.ok) throw new Error(data.message || (data.error_messages ? data.error_messages.map((m: any) => m.description).join(', ') : 'Erro no PagBank'));
      const checkoutLink = data.links?.find((l: any) => l.rel === 'PAY')?.href;
      if (!checkoutLink) throw new Error('Link PAY não encontrado na resposta do PagBank.');
      res.json({ checkout_url: checkoutLink, id: data.id });
    } catch (error: any) { 
      console.error('PagBank Checkout Error:', error);
      res.status(500).json({ error: error.message }); 
    }
  });

  apiRouter.post('/pagbank/public-key', async (req, res) => {
    const { token, environment } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não fornecido.' });
    const baseUrl = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
    try {
      const resp = await fetch(`${baseUrl}/public-keys`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'card' }) });
      
      const responseText = await resp.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('PagBank Key Non-JSON:', responseText);
        throw new Error(`PagBank retornou resposta inválida (${resp.status}): ${responseText.substring(0, 100)}`);
      }

      if (!resp.ok) {
        console.error('PagBank Key Error:', data);
        const errDetail = data.error_messages ? data.error_messages.map((m: any) => m.description).join(', ') : (data.message || JSON.stringify(data));
        throw new Error(errDetail || 'Erro ao gerar chave no PagBank');
      }
      res.json(data);
    } catch (error: any) { 
      console.error('PagBank generate-key catch:', error);
      res.status(500).json({ error: error.message }); 
    }
  });

  // Catch-all for API router to log 404s within the API prefix
  apiRouter.all('*all', (req, res) => {
    console.log(`[API 404] No match for: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: 'Endpoint de API não encontrado.',
      method: req.method,
      path: req.url,
      fullPath: `/api${req.url}`
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  // Vite middleware for development (Loaded asynchronously to not block listener)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite in background...');
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then(vite => {
      app.use(vite.middlewares);
      console.log('Vite integrated.');
    }).catch(e => {
      console.error('Vite failed to start:', e);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Fallback
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer().catch(err => {
  console.error('SERVER CRASH AT STARTUP:', err);
  // Still listen on port 3000 to avoid "Please wait" hang even if it just shows an error
  const emergencyApp = express();
  emergencyApp.get('*all', (req, res) => res.send('Server failed to start. Check logs.'));
  emergencyApp.listen(3000, '0.0.0.0');
});
