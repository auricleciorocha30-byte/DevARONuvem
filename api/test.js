export default function handler(request, response) {
  response.status(200).json({
    message: "Cloudflare/Vercel JS Function Test OK",
    time: new Date().toISOString()
  });
}
