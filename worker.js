export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-requested-with",
      "Access-Control-Max-Age": "86400",
    };

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // API HEALTH CHECK
    if (url.pathname === "/api-health") {
      return new Response(JSON.stringify({ 
        status: "ok", 
        platform: "Cloudflare Worker",
        version: "1.0.1"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // PAGBANK WEBHOOK
    if (url.pathname === "/api/webhooks/pagbank") {
      try {
        const body = await request.clone().json();
        console.log("PagBank Webhook received:", body);
        
        let reference_id = body.reference_id;
        let status = body.status;

        if (body.charges && body.charges.length > 0) {
            status = body.charges[0].status;
            reference_id = body.charges[0].reference_id || reference_id;
        }
        
        if (reference_id) {
          const mainTursoUrl = "https://produtodevaro-auricleciorocha30-byte.aws-us-east-1.turso.io";
          const mainTursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMzYwOTMsImlkIjoiMDE5YzliNzctZGMwMS03MmIwLWFmYWItYWRlOGY0MjM5YTBjIiwicmlkIjoiYTQyYjFmY2EtYjc0YS00MGMwLTk3M2QtODlmNmFlMTBkYzFiIn0.A7LAbG4yZ70-XPczvHXgaVUm2t_rJuTlsMpefd86FVprMb50rPZU5aICZdVvQvXpdnwOiav_nNMRCOOmi2cQDQ";
          
          let targetDbUrl = mainTursoUrl;
          let targetDbToken = mainTursoToken;

          const slug = url.searchParams.get('slug');
          
          if (slug) {
              try {
                  const querySql = `SELECT dbUrl, dbAuthToken FROM store_profiles WHERE slug = '${slug}' LIMIT 1`;
                  const resp = await fetch(mainTursoUrl, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${mainTursoToken}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ statements: [{ q: querySql, params: [] }] })
                  });
                  const json = await resp.json();
                  if (json[0]?.results?.rows?.length > 0) {
                      const row = json[0].results.rows[0];
                      const cols = json[0].results.columns;
                      const dbUrlIndex = cols.indexOf('dbUrl');
                      const dbTokenIndex = cols.indexOf('dbAuthToken');
                      if (row[dbUrlIndex] && row[dbTokenIndex]) {
                          targetDbUrl = row[dbUrlIndex];
                          targetDbToken = row[dbTokenIndex];

                          if (targetDbUrl.startsWith('libsql://')) {
                              targetDbUrl = targetDbUrl.replace('libsql://', 'https://');
                          }
                      }
                  }
              } catch (e) {
                  console.error("Failed to query store database details:", e);
              }
          }
          
          let newStatus = 'PENDENTE';
          if (status === 'PAID' || status === 'COMPLETED' || status === 'AUTHORIZED') {
            newStatus = 'PAGO';
          } else if (status === 'CANCELED' || status === 'DECLINED') {
            newStatus = 'CANCELADO';
          }

          const updateSql = `UPDATE orders SET status = '${newStatus}' WHERE id = '${reference_id}' OR id = ${isNaN(Number(reference_id)) ? -1 : Number(reference_id)}`;
          await fetch(targetDbUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${targetDbToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              statements: [{ q: updateSql, params: [] }]
            })
          });
          
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        }
        
        return new Response("OK", { status: 200, headers: corsHeaders });
      } catch (error) {
        console.error("Webhook Error:", error);
        return new Response("OK", { status: 200, headers: corsHeaders }); // Always return 200 to PagBank
      }
    }

    // MERCADO PAGO WEBHOOK (Notifications)
    if (url.pathname === "/api/webhooks/mercadopago" && request.method === "POST") {
      try {
        const urlParams = new URL(request.url).searchParams;
        const topic = urlParams.get("topic") || urlParams.get("type");
        const id = urlParams.get("id") || urlParams.get("data.id");
        
        let status = '';
        let external_reference = '';
        
        // As MP webhook doesn't include the full transaction body, we typically need to fetch it
        // However, we can also extract information if it's a payment webhook
        if (topic === 'payment' && id) {
          // Since we need to query the DB but we don't know the exact order ID yet without querying MP,
          // Let's get the slug first
          const slug = urlParams.get('slug');
          
          if (slug) {
              const mainTursoUrl = "https://produtodevaro-auricleciorocha30-byte.aws-us-east-1.turso.io";
              const mainTursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMzYwOTMsImlkIjoiMDE5YzliNzctZGMwMS03MmIwLWFmYWItYWRlOGY0MjM5YTBjIiwicmlkIjoiYTQyYjFmY2EtYjc0YS00MGMwLTk3M2QtODlmNmFlMTBkYzFiIn0.A7LAbG4yZ70-XPczvHXgaVUm2t_rJuTlsMpefd86FVprMb50rPZU5aICZdVvQvXpdnwOiav_nNMRCOOmi2cQDQ";
              
              let targetDbUrl = mainTursoUrl;
              let targetDbToken = mainTursoToken;
              let onlinePaymentAccessToken = '';

              try {
                  const querySql = `SELECT dbUrl, dbAuthToken, settings FROM store_profiles WHERE slug = '${slug}' LIMIT 1`;
                  const resp = await fetch(mainTursoUrl, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${mainTursoToken}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ statements: [{ q: querySql, params: [] }] })
                  });
                  const json = await resp.json();
                  if (json[0]?.results?.rows?.length > 0) {
                      const row = json[0].results.rows[0];
                      const cols = json[0].results.columns;
                      const dbUrlIndex = cols.indexOf('dbUrl');
                      const dbTokenIndex = cols.indexOf('dbAuthToken');
                      const settingsIndex = cols.indexOf('settings');
                      
                      if (row[dbUrlIndex] && row[dbTokenIndex]) {
                          targetDbUrl = row[dbUrlIndex].replace('libsql://', 'https://');
                          targetDbToken = row[dbTokenIndex];
                          
                          if (row[settingsIndex]) {
                            try {
                               const storeSettings = JSON.parse(row[settingsIndex]);
                               onlinePaymentAccessToken = storeSettings.onlinePaymentAccessToken;
                            } catch(e){}
                          }
                      }
                  }
                  
                  if (onlinePaymentAccessToken) {
                      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                          headers: { 'Authorization': `Bearer ${onlinePaymentAccessToken}` }
                      });
                      const mpData = await mpResp.json();
                      
                      if (mpData && mpData.status) {
                          status = mpData.status;
                          external_reference = mpData.external_reference;
                          
                          if (external_reference) {
                              let newStatus = 'PENDENTE';
                              if (status === 'approved') newStatus = 'PAGO';
                              else if (status === 'cancelled' || status === 'rejected') newStatus = 'CANCELADO';
                    
                              const updateSql = `UPDATE orders SET status = '${newStatus}' WHERE id = '${external_reference}' OR id = ${isNaN(Number(external_reference)) ? -1 : Number(external_reference)}`;
                              await fetch(targetDbUrl, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${targetDbToken}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ statements: [{ q: updateSql, params: [] }] })
                              });
                          }
                      }
                  }
              } catch (e) {
                  console.error("MP Webhook failed:", e);
              }
          }
        }
        return new Response("OK", { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response("OK", { status: 200, headers: corsHeaders }); 
      }
    }

    // PAGBANK CHECKOUT (Unified Path)
    if (url.pathname === "/api/pbank/checkout" || url.pathname === "/api/v1/process-payment" || url.pathname === "/api/v1/process-payment/") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      try {
        const body = await request.json();
        const { token, environment, orderData, storeUrl, storeSlug } = body;

        if (!token) {
          return new Response(JSON.stringify({ error: "Token não fornecido." }), { status: 400, headers: corsHeaders });
        }

        const baseUrl = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
        
        const items = orderData.items.map((item) => ({ 
          name: item.name, 
          quantity: item.quantity, 
          unit_amount: Math.round(item.price * 100) 
        }));
        
        if (orderData.deliveryFee > 0) items.push({ name: 'Taxa de Entrega', quantity: 1, unit_amount: Math.round(orderData.deliveryFee * 100) });
        if (orderData.serviceFee > 0) items.push({ name: 'Taxa de Serviço', quantity: 1, unit_amount: Math.round(orderData.serviceFee * 100) });

        let amountToCharge = orderData.total;
        if (orderData.paymentDetails) {
          try {
            const details = JSON.parse(orderData.paymentDetails);
            const onlinePayment = details.find((d) => d.method === 'ONLINE');
            if (onlinePayment) amountToCharge = onlinePayment.amount;
          } catch (e) {}
        }

        const redirectUrl = storeUrl.includes('?') 
          ? `${storeUrl}&payment=success&orderId=${orderData.id}` 
          : `${storeUrl}?payment=success&orderId=${orderData.id}`;

        const notificationUrl = storeSlug 
            ? `${new URL(request.url).origin}/api/webhooks/pagbank?slug=${storeSlug}`
            : `${new URL(request.url).origin}/api/webhooks/pagbank`;

        const pagbankBody = {
          reference_id: orderData.id,
          items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
            ? [{ name: `Pedido #${orderData.displayId}`, quantity: 1, unit_amount: Math.round(amountToCharge * 100) }]
            : items,
          redirect_url: redirectUrl,
          notification_urls: [notificationUrl],
          payment_methods: [{ type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }, { type: 'BOLETO' }, { type: 'PIX' }]
        };

        if (orderData.customerName && orderData.customerName !== 'Cliente PDV') {
          const nameParts = orderData.customerName.trim().split(' ');
          if (nameParts.length >= 2) {
            pagbankBody.customer = { name: orderData.customerName, email: 'cliente@email.com' };
          }
        }

        const resp = await fetch(`${baseUrl}/checkouts`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(pagbankBody)
        });

        const data = await resp.json();
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: data.message || "Erro no PagBank" }), { 
              status: resp.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const checkoutLink = data.links?.find((l) => l.rel === 'PAY')?.href;
        return new Response(JSON.stringify({ checkout_url: checkoutLink, id: data.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // MERCADO PAGO CREATE PREFERENCE
    if (url.pathname === "/api/mercado-pago/create-preference" && request.method === "POST") {
      try {
        const body = await request.json();
        const { accessToken, orderData, storeUrl } = body;

        if (!accessToken) {
          return new Response(JSON.stringify({ error: "Access Token não fornecido." }), { status: 400, headers: corsHeaders });
        }

        const items = orderData.items.map((item) => ({
          id: item.productId || item.id,
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: 'BRL'
        }));
        
        if (orderData.deliveryFee > 0) items.push({ id: 'delivery_fee', title: 'Taxa de Entrega', quantity: 1, unit_price: orderData.deliveryFee, currency_id: 'BRL' });
        if (orderData.serviceFee > 0) items.push({ id: 'service_fee', title: 'Taxa de Serviço', quantity: 1, unit_price: orderData.serviceFee, currency_id: 'BRL' });
        
        let amountToCharge = orderData.total;
        if (orderData.paymentDetails) {
          try {
            const details = JSON.parse(orderData.paymentDetails);
            const onlinePayment = details.find((d) => d.method === 'ONLINE');
            if (onlinePayment) amountToCharge = onlinePayment.amount;
          } catch (e) {}
        }

        const payload = {
          items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
            ? [{ id: orderData.id, title: `Pedido #${orderData.displayId}`, quantity: 1, unit_price: amountToCharge, currency_id: 'BRL' }]
            : items,
          external_reference: orderData.id,
          notification_url: `${new URL(request.url).origin}/api/webhooks/mercadopago?slug=${storeSlug}`,
          back_urls: {
            success: storeUrl.includes('?') ? `${storeUrl}&payment=success&orderId=${orderData.id}` : `${storeUrl}?payment=success&orderId=${orderData.id}`,
            failure: storeUrl.includes('?') ? `${storeUrl}&payment=failure&orderId=${orderData.id}` : `${storeUrl}?payment=failure&orderId=${orderData.id}`,
            pending: storeUrl.includes('?') ? `${storeUrl}&payment=pending&orderId=${orderData.id}` : `${storeUrl}?payment=pending&orderId=${orderData.id}`
          },
          auto_return: 'approved'
        };

        const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) {
           throw new Error(data.message || 'Erro ao criar preferência do Mercado Pago');
        }

        return new Response(JSON.stringify({ init_point: data.init_point, id: data.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // MERCADO PAGO POINT CREATE PAYMENT INTENT
    if (url.pathname === "/api/mercado-pago/point/create-payment-intent" && request.method === "POST") {
      try {
        const body = await request.json();
        const { accessToken, deviceId, amount, description, externalReference } = body;
        
        if (!accessToken || !deviceId) {
           return new Response(JSON.stringify({ error: 'Access Token ou Device ID não fornecido.' }), { status: 400, headers: corsHeaders });
        }

        const resp = await fetch(`https://api.mercadopago.com/point/integration-api/devices/${deviceId}/payment-intents`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: Math.round(amount * 100) / 100, 
            description: description || 'Venda PDV', 
            external_reference: externalReference, 
            payment: { installments: 1, type: 'credit_card' } 
          })
        });
        
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'Erro na maquininha.');

        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // MERCADO PAGO POINT CHECK PAYMENT INTENT
    if (url.pathname.startsWith("/api/mercado-pago/point/payment-intent/") && request.method === "GET") {
      try {
        const id = url.pathname.split("/").pop();
        const accessToken = url.searchParams.get("accessToken");

        if (!accessToken) return new Response(JSON.stringify({ error: 'Access Token não fornecido.' }), { status: 400, headers: corsHeaders });

        const resp = await fetch(`https://api.mercadopago.com/point/integration-api/payment-intents/${id}`, { 
           headers: { 'Authorization': `Bearer ${accessToken}` } 
        });
        const data = await resp.json();
        
        return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro ao consultar status.' }), { status: 500, headers: corsHeaders });
      }
    }

    // FOCUS NFE EMIT
    if (url.pathname === "/api/focus-nfe/emit-nfce" && request.method === "POST") {
      try {
        const body = await request.json();
        const { token, environment, nfceData, reference } = body;
        if (!token) return new Response(JSON.stringify({ error: 'Token não fornecido.' }), { status: 400, headers: corsHeaders });
        const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const resp = await fetch(`${baseUrl}/v2/nfce?ref=${reference}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${btoa(token + ':')}` },
          body: JSON.stringify(nfceData)
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro na Focus NFe.' }), { status: 500, headers: corsHeaders });
      }
    }

    // FOCUS NFE CONSULT
    if (url.pathname === "/api/focus-nfe/consult-nfce" && request.method === "GET") {
      try {
        const token = url.searchParams.get("token");
        const environment = url.searchParams.get("environment");
        const reference = url.searchParams.get("reference");
        if (!token || !reference) return new Response(JSON.stringify({ error: 'Dados incompletos.' }), { status: 400, headers: corsHeaders });
        const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const resp = await fetch(`${baseUrl}/v2/nfce/${reference}`, { headers: { 'Authorization': `Basic ${btoa(token + ':')}` } });
        const data = await resp.json();
        return new Response(JSON.stringify(data), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro de consulta.' }), { status: 500, headers: corsHeaders });
      }
    }

    // FOCUS NFE CANCEL
    if (url.pathname === "/api/focus-nfe/cancel-nfce" && request.method === "DELETE") {
      try {
        const body = await request.json();
        const { token, environment, reference, justificativa } = body;
        if (!token || !reference) return new Response(JSON.stringify({ error: 'Dados incompletos.' }), { status: 400, headers: corsHeaders });
        const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const resp = await fetch(`${baseUrl}/v2/nfce/${reference}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${btoa(token + ':')}` },
          body: JSON.stringify({ justificativa: justificativa || 'Cancelamento solicitado.' })
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro ao cancelar.' }), { status: 500, headers: corsHeaders });
      }
    }

    // BARCODE LOOKUP
    if (url.pathname.startsWith("/api/barcode-lookup/") && request.method === "GET") {
      try {
        const code = url.pathname.split("/").pop();
        const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
        const data = await resp.json();
        if (data.status === 1) {
          return new Response(JSON.stringify({ name: data.product.product_name || '', description: data.product.generic_name || '', brand: data.product.brands || '', ncm: '21069090' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});
        } else {
          return new Response(JSON.stringify({ error: 'Não encontrado.' }), { status: 404, headers: corsHeaders });
        }
      } catch (error) {
         return new Response(JSON.stringify({ error: 'Erro no serviço.' }), { status: 500, headers: corsHeaders });
      }
    }

    // ASSET FALLBACK
    return env.ASSETS.fetch(request);
  }
};
