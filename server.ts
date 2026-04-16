import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Route for Mercado Pago Checkout Pro
  app.post('/api/mercado-pago/create-preference', async (req, res) => {
    const { accessToken, orderData, storeUrl } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access Token do Mercado Pago não fornecido.' });
    }

    try {
      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      const items = orderData.items.map((item: any) => ({
        id: item.productId,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'BRL'
      }));

      // Add delivery fee if present
      if (orderData.deliveryFee && orderData.deliveryFee > 0) {
        items.push({
          id: 'delivery_fee',
          title: 'Taxa de Entrega',
          quantity: 1,
          unit_price: orderData.deliveryFee,
          currency_id: 'BRL'
        });
      }

      // Add service fee if present
      if (orderData.serviceFee && orderData.serviceFee > 0) {
        items.push({
          id: 'service_fee',
          title: 'Taxa de Serviço',
          quantity: 1,
          unit_price: orderData.serviceFee,
          currency_id: 'BRL'
        });
      }

      // Handle discount (Mercado Pago doesn't have a direct discount field in items, 
      // so we can add a negative item or just apply it to the total, but MP doesn't allow negative unit_price.
      // A common workaround is to apply the discount proportionally or just not send items if it's too complex,
      // but let's just send the total if there's a discount to avoid item mismatch, or subtract from items).
      // For simplicity, if there's a discount or mixed payment, we'll just send a single item "Pedido #ID".
      let finalItems = items;
      let amountToCharge = orderData.total;

      // Check if it's a mixed payment with ONLINE
      if (orderData.paymentDetails) {
        try {
          const details = JSON.parse(orderData.paymentDetails);
          const onlinePayment = details.find((d: any) => d.method === 'ONLINE');
          if (onlinePayment) {
            amountToCharge = onlinePayment.amount;
          }
        } catch (e) {
          console.error("Error parsing payment details", e);
        }
      }

      if ((orderData.discountAmount && orderData.discountAmount > 0) || amountToCharge !== orderData.total) {
        finalItems = [{
          id: orderData.id,
          title: `Pedido #${orderData.displayId}`,
          quantity: 1,
          unit_price: amountToCharge,
          currency_id: 'BRL'
        }];
      }

      const body = {
        items: finalItems,
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
      console.error('Erro ao criar preferência no Mercado Pago:', error);
      res.status(500).json({ error: 'Erro ao gerar pagamento online.' });
    }
  });

  // API Route for Mercado Pago Point (Maquininha)
  app.post('/api/mercado-pago/point/create-payment-intent', async (req, res) => {
    const { accessToken, deviceId, amount, description, externalReference } = req.body;

    if (!accessToken || !deviceId) {
      return res.status(400).json({ error: 'Access Token ou Device ID não fornecido.' });
    }

    try {
      const response = await fetch(`https://api.mercadopago.com/point/integration-api/devices/${deviceId}/payment-intents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-test-scope': process.env.NODE_ENV === 'production' ? '' : 'sandbox' // Optional: handle sandbox
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100) / 100, // Ensure 2 decimal places
          description: description || 'Venda PDV',
          external_reference: externalReference,
          payment: {
            installments: 1,
            type: 'credit_card' // Default to credit, but Point usually allows choosing on device
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar intenção de pagamento na maquininha.');
      }

      res.json(data);
    } catch (error: any) {
      console.error('Erro no Mercado Pago Point:', error);
      res.status(500).json({ error: error.message || 'Erro ao comunicar com a maquininha.' });
    }
  });

  app.get('/api/mercado-pago/point/payment-intent/:id', async (req, res) => {
    const { id } = req.params;
    const accessToken = req.query.accessToken as string;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access Token não fornecido.' });
    }

    try {
      const response = await fetch(`https://api.mercadopago.com/point/integration-api/payment-intents/${id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Erro ao consultar status da maquininha:', error);
      res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
    }
  });

  // API Route for Focus NFe NFC-e Emission
  app.post('/api/focus-nfe/emit-nfce', async (req, res) => {
    const { token, environment, nfceData, reference } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token da Focus NFe não fornecido.' });
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.focusnfe.com.br' 
      : 'https://homologacao.focusnfe.com.br';

    const url = `${baseUrl}/v2/nfce?ref=${reference}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`
        },
        body: JSON.stringify(nfceData)
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Erro ao comunicar com Focus NFe:', error);
      res.status(500).json({ error: 'Erro interno ao comunicar com a API de Notas Fiscais.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
