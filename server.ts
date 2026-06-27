import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { supabase } from './lib/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

// Configuração de Rate Limit (Proteção contra força bruta e DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Limite de 500 requisições por IP por janela
  standardHeaders: true, // Retorna informação no `RateLimit-*` headers
  legacyHeaders: false, // Desabilita `X-RateLimit-*` headers
  message: { error: 'Muitas requisições deste IP. Tente novamente mais tarde.' }
});

async function startServer() {
  // Configuração de Segurança (Helmets) - ajustado para permitir Vite/iFrame no ambiente de desenvolvimento
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  
  app.use(limiter);
  app.use(cors());
  app.use(express.json({ 
    limit: '10mb',
    // Capture raw body for signature verification if needed (MP usually uses headers + id)
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

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

  // API Route for Mercado Pago PIX
  apiRouter.post('/mercado-pago/create-pix', async (req, res) => {
    const { accessToken, orderData, storeSlug } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access Token do Mercado Pago não fornecido.' });
    
    try {
      let amountToCharge = Number(orderData.total);
      if (orderData.paymentDetails) {
        try {
          const details = typeof orderData.paymentDetails === 'string' ? JSON.parse(orderData.paymentDetails) : orderData.paymentDetails;
          const onlinePayment = details.find((d: any) => d.method === 'ONLINE' || d.method === 'PIX');
          if (onlinePayment) amountToCharge = Number(onlinePayment.amount);
        } catch (e) {}
      }

      const payload = {
        transaction_amount: Number(amountToCharge.toFixed(2)),
        description: `Pedido #${orderData.displayId || ''}`,
        payment_method_id: "pix",
        external_reference: String(orderData.id || `pos_${Date.now()}`),
        notification_url: storeSlug ? `https://${req.get('host')}/api/webhooks/mercadopago?slug=${storeSlug}` : undefined,
        payer: {
          email: "cliente@email.com",
          first_name: orderData.customerName ? orderData.customerName.split(' ')[0] : "Cliente"
        }
      };

      const resp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': `${orderData.id || 'pos'}-${Date.now()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (!resp.ok) {
         console.error("Mercado Pago Pix Error:", data);
         throw new Error(data.message || JSON.stringify(data) || 'Erro ao gerar Pix no Mercado Pago');
      }

      res.json({ 
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        id: data.id 
      });
    } catch (error: any) {
      console.error('Create Pix Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get('/mercado-pago/payment-status/:id', async (req, res) => {
    const { id } = req.params;
    const accessToken = req.query.accessToken as string;
    if (!accessToken) return res.status(400).json({ error: 'Access Token não fornecido.' });
    try {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
    }
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
      let data;
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Focus NFe gave non-JSON response:', text);
        if (text.includes('HTTP Basic: Access denied')) {
           return res.status(401).json({ error: `Acesso negado: O token configurado é inválido. Se você mudou para o ambiente de Produção, lembre-se de configurar o token de Produção (que é diferente do token de Homologação).` });
        }
        return res.status(resp.status).json({ error: `Erro na Focus NFe: ${text.substring(0, 100)}` });
      }
      res.status(resp.status).json(data);
    } catch (error) { 
      console.error('Focus NFe API Error:', error);
      res.status(500).json({ error: `Erro na Focus NFe. ${error instanceof Error ? error.message : String(error)}` }); 
    }
  });

  apiRouter.get('/focus-nfe/consult-nfce', async (req, res) => {
    const { token, environment, reference } = req.query;
    if (!token || !reference) return res.status(400).json({ error: 'Dados incompletos.' });
    const baseUrl = (environment as string) === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    try {
      const resp = await fetch(`${baseUrl}/v2/nfce/${reference}`, { headers: { 'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}` } });
      let data;
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Focus NFe consult gave non-JSON response:', text);
        if (text.includes('HTTP Basic: Access denied')) {
           return res.status(401).json({ error: `Acesso negado: O token configurado é inválido para este ambiente.` });
        }
        return res.status(resp.status).json({ error: `Erro na Focus NFe (consulta): ${text.substring(0, 100)}` });
      }
      res.status(resp.status).json(data);
    } catch (error) { res.status(500).json({ error: `Erro de consulta. ${error instanceof Error ? error.message : String(error)}` }); }
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
      let data;
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Focus NFe cancel gave non-JSON response:', text);
        if (text.includes('HTTP Basic: Access denied')) {
           return res.status(401).json({ error: `Acesso negado: O token configurado é inválido para este ambiente.` });
        }
        return res.status(resp.status).json({ error: `Erro na Focus NFe (cancelamento): ${text.substring(0, 100)}` });
      }
      res.status(resp.status).json(data);
    } catch (error) { res.status(500).json({ error: `Erro ao cancelar. ${error instanceof Error ? error.message : String(error)}` }); }
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

  // Mercado Pago Webhook Idempotency (In-memory cache)
  // NOTE: For production, migrate this to Redis or a DATABASE table.
  const processedNotifications = new Set<string>();

  /**
   * HMAC-SHA256 Signature Verification for Mercado Pago (Multi-store)
   * References: "Validate signatures" in Mercado Pago Developers documentation.
   */
  apiRouter.post('/webhooks/mercadopago/:storeId', async (req, res) => {
    const { storeId } = req.params;
    try {
      const signatureHeader = req.headers['x-signature'] as string;
      const requestId = req.headers['x-request-id'] as string;

      console.log(`[MP WEBHOOK] Notification for Store: ${storeId}. ID: ${req.body?.data?.id || req.body?.id}`);

      // Fetch the store's secret from the database
      const { data: store, error: storeError } = await supabase
        .from('store_profiles')
        .select('mercadopago_webhook_secret, dbUrl, dbAuthToken')
        .eq('id', storeId)
        .maybeSingle();

      if (storeError || !store) {
        console.error(`[MP WEBHOOK] Store ${storeId} not found or error:`, storeError);
        return res.status(404).send('Store not found');
      }

      const webhookSecret = store.mercadopago_webhook_secret;

      if (!webhookSecret) {
        console.warn(`[MP WEBHOOK] Webhook secret not configured for store ${storeId}. Skipping verification.`);
        // Note: For high security, you should return 403 here instead of continuing.
        // But to avoid blocking notifications before the user configures it, we log it.
      }

      // 1. Signature Validation (Only if secret is configured)
      if (webhookSecret && signatureHeader) {
        const parts = signatureHeader.split(',');
        const tsPart = parts.find(p => p.startsWith('ts='));
        const v1Part = parts.find(p => p.startsWith('v1='));

        if (tsPart && v1Part && requestId) {
          const ts = tsPart.split('=')[1];
          const v1 = v1Part.split('=')[1];
          
          const now = Math.floor(Date.now() / 1000);
          if (Math.abs(now - parseInt(ts)) > 300) {
            console.warn('[MP WEBHOOK] Signature expired');
            return res.status(403).send('Signature expired');
          }

          const resourceId = req.body?.data?.id || req.body?.id;
          if (resourceId) {
            const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
            const computedSignature = crypto
              .createHmac('sha256', webhookSecret)
              .update(manifest)
              .digest('hex');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(computedSignature, 'hex'),
                Buffer.from(v1, 'hex')
            );

            if (!isValid) {
              console.warn(`[MP WEBHOOK] Invalid signature for Store: ${storeId}, Resource: ${resourceId}`);
              return res.status(403).send('Invalid signature');
            }
          }
        }
      }

      // 2. Idempotency Check
      const notificationId = req.headers['x-request-id'] as string || req.body.id;
      if (notificationId && processedNotifications.has(notificationId)) {
        return res.status(200).send('Already processed');
      }

      // 3. Process the Notification
      const action = req.body.action || req.body.topic;
      const dataId = req.body.data?.id || req.body.id;

      console.log(`[MP WEBHOOK] Validated for Store ${storeId}. Action: ${action}, Data ID: ${dataId}`);

      if ((action === 'payment.created' || action === 'payment.updated' || req.body.topic === 'payment') && store.dbUrl) {
         // Connect to the specific store's database for processing
         // In this ERP, we typically would update the order status.
         console.log(`[MP WEBHOOK] Store ${storeId} payment update needed for ${dataId}`);
      }

      if (notificationId) {
        processedNotifications.add(notificationId);
        setTimeout(() => processedNotifications.delete(notificationId), 3600000);
      }

      res.status(200).json({ status: 'success' });

    } catch (error) {
      console.error('[MP WEBHOOK] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
