export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await request.json();
    const { token, environment, orderData, storeUrl } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token não fornecido." }), { status: 400 });
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

    const pagbankBody = {
      reference_id: orderData.id,
      items: (orderData.discountAmount > 0 || amountToCharge !== orderData.total) 
        ? [{ name: `Pedido #${orderData.displayId}`, quantity: 1, unit_amount: Math.round(amountToCharge * 100) }]
        : items,
      redirect_url: `${storeUrl}?payment=success&orderId=${orderData.id}`,
      notification_urls: [`${storeUrl}/api/webhooks/pagbank`],
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
      return new Response(JSON.stringify({ error: data.message || "Erro no PagBank" }), { status: resp.status });
    }

    const checkoutLink = data.links?.find((l) => l.rel === 'PAY')?.href;
    return new Response(JSON.stringify({ checkout_url: checkoutLink, id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
