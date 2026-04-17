
async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/pagbank/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test', environment: 'sandbox', orderData: { id: '1', items: [] }, storeUrl: 'http://localhost' })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (e) {
    console.error('Fetch error:', e);
  }
}
test();
