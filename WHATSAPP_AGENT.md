# Segretario AI su WhatsApp (Kapso + Claude)

Funzione: `netlify/functions/whatsapp-agent.js` → URL `https://<sito>/.netlify/functions/whatsapp-agent`

Variabili d'ambiente Netlify: KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, KAPSO_WEBHOOK_SECRET, ANTHROPIC_API_KEY,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (scope calendar), opzionali OWNER_WHATSAPP, GOOGLE_CALENDAR_ID.

Webhook Kapso: evento `whatsapp.message.received`, firma HMAC-SHA256 in `X-Webhook-Signature`.
Regola: nessun dato finanziario via WhatsApp, solo logistica appuntamenti.
