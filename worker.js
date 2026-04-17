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
        
        const { reference_id, status } = body;
        
        if (reference_id) {
          const tursoUrl = "https://produtodevaro-auricleciorocha30-byte.aws-us-east-1.turso.io";
          const tursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMzYwOTMsImlkIjoiMDE5YzliNzctZGMwMS03MmIwLWFmYWItYWRlOGY0MjM5YTBjIiwicmlkIjoiYTQyYjFmY2EtYjc0YS00MGMwLTk3M2QtODlmNmFlMTBkYzFiIn0.A7LAbG4yZ70-XPczvHXgaVUm2t_rJuTlsMpefd86FVprMb50rPZU5aICZdVvQvXpdnwOiav_nNMRCOOmi2cQDQ";
          
          let newStatus = 'PENDENTE';
          if (status === 'PAID' || status === 'COMPLETED' || status === 'AUTHORIZED') {
            newStatus = 'PAGO';
          } else if (status === 'CANCELED' || status === 'DECLINED') {
            newStatus = 'CANCELADO';
          }

          const updateSql = `UPDATE orders SET status = '${newStatus}' WHERE id = '${reference_id}'`;
          await fetch(tursoUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tursoToken}`,
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

    // PAGBANK CHECKOUT (Unified Path)
    if (url.pathname === "/api/pbank/checkout" || url.pathname === "/api/v1/process-payment" || url.pathname === "/api/v1/process-payment/") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
      }

      try {
        const body = await request.json();
        const { token, environment, orderData, storeUrl } = body;

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

        const pagbankBody = {
          reference_id: orderData.id,
          items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
            ? [{ name: `Pedido #${orderData.displayId}`, quantity: 1, unit_amount: Math.round(amountToCharge * 100) }]
            : items,
          redirect_url: redirectUrl,
          notification_urls: [`${new URL(request.url).origin}/api/webhooks/pagbank`],
          payment_methods: [{ type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }, { type: 'BOLETO' }, { type: 'PIX' }]
        };

        if (orderData.customerName && orderData.customerName !== 'Cliente PDV') {
          pagbankBody.customer = { name: orderData.customerName, email: 'cliente@email.com' };
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

    // ASSET FALLBACK
    return env.ASSETS.fetch(request);
  }
};
