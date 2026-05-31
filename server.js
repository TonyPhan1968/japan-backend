/**
 * Japan Trip Finder — Node.js / Express Backend
 * Endpoints:
 *   GET  /search?query=...       — Google Places text search
 *   GET  /details?place_id=...   — Google Places details
 *   POST /ask                    — Claude AI travel assistant
 *   GET  /health                 — Health check
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_KEY    = process.env.GOOGLE_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!GOOGLE_KEY)    { console.error('❌  GOOGLE_API_KEY missing');    process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('❌  ANTHROPIC_API_KEY missing'); process.exit(1); }

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params: { query, key: GOOGLE_KEY, language: 'en', location: '36.2048,138.2529', radius: 500000 } }
    );
    const { status, results, error_message } = response.data;
    if (status !== 'OK' && status !== 'ZERO_RESULTS')
      return res.status(502).json({ error: error_message || status });
    const places = (results || []).map(p => ({
      place_id: p.place_id, name: p.name, formatted_address: p.formatted_address,
      rating: p.rating, user_ratings_total: p.user_ratings_total, types: p.types,
      opening_hours: p.opening_hours, price_level: p.price_level, geometry: p.geometry,
      photos: p.photos?.slice(0, 1),
    }));
    return res.json({ results: places, status });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Place Details ────────────────────────────────────────────────────────────
app.get('/details', async (req, res) => {
  const place_id = (req.query.place_id || '').trim();
  if (!place_id) return res.status(400).json({ error: 'Missing place_id' });
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      { params: { place_id, key: GOOGLE_KEY, language: 'en', fields: 'name,formatted_address,rating,user_ratings_total,opening_hours,website,formatted_phone_number,photos,price_level,types,geometry,url' } }
    );
    const { status, result, error_message } = response.data;
    if (status !== 'OK') return res.status(502).json({ error: error_message || status });
    const photos = (result.photos || []).slice(0, 3).map(p => ({
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_KEY}`,
      attribution: p.html_attributions?.[0] || ''
    }));
    return res.json({
      place_id, name: result.name, formatted_address: result.formatted_address,
      rating: result.rating, user_ratings_total: result.user_ratings_total,
      opening_hours: result.opening_hours, website: result.website,
      phone: result.formatted_phone_number, price_level: result.price_level,
      types: result.types, geometry: result.geometry, google_maps_url: result.url, photos,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── AI Travel Assistant ──────────────────────────────────────────────────────
app.post('/ask', async (req, res) => {
  const { question, city } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const systemPrompt = `You are a friendly and knowledgeable Japan travel expert. The user is visiting Japan in June-July 2026, staying in Tokyo, Kyoto and Osaka. Their itinerary: arrive Tokyo 26 Jun, Tokyo until 2 Jul, Osaka 2-5 Jul, Kyoto 5-8 Jul, back to Tokyo 8-11 Jul, depart 11 Jul. They have a Japan Rail Pass. Answer questions helpfully and concisely in under 150 words. Be specific and practical. The user is currently looking at ${city || 'Japan'}.`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      },
      { headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );
    const text = response.data.content?.[0]?.text || 'Sorry, I could not answer that.';
    return res.json({ answer: text });
  } catch (err) {
    console.error('Claude API error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Could not get answer from AI' });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅  Japan backend running → http://localhost:${PORT}`));
