const url = 'https://produtodevaro-auricleciorocha30-byte.aws-us-east-1.turso.io';
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMzYwOTMsImlkIjoiMDE5YzliNzctZGMwMS03MmIwLWFmYWItYWRlOGY0MjM5YTBjIiwicmlkIjoiYTQyYjFmY2EtYjc0YS00MGMwLTk3M2QtODlmNmFlMTBkYzFiIn0.A7LAbG4yZ70-XPczvHXgaVUm2t_rJuTlsMpefd86FVprMb50rPZU5aICZdVvQvXpdnwOiav_nNMRCOOmi2cQDQ';

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    statements: [
      { q: 'SELECT id, slug, length(logoUrl), length(settings) FROM store_profiles', params: [] }
    ]
  })
}).then(r => r.text()).then(t => console.log(t)).catch(e => console.error(e));
