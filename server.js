/**
 * Japan Trip Finder — Node.js / Express Backend
 * Endpoints:
 *   GET /search?query=...       — Text search
 *   GET /details?place_id=...   — Place details (photos, hours, website, phone)
 *   GET /health                 — Health check
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PORT || 3001;
const KEY  = process.env.GOOGLE_API_KEY;

if (!KEY) {
  console.error('❌  GOOGLE_API_KEY is missing — create a .env file');
  process.exit(1);
}

app.use(cors({ origin: '*' }));

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query,
          key:      KEY,
          language: 'en',
          location: '36.2048,138.2529',
          radius:   500000,
        },
      }
    );

    const { status, results, error_message } = response.data;
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      return res.status(502).json({ error: error_message || status });
    }

    const places = (results || []).map(p => ({
      place_id:           p.place_id,
      name:               p.name,
      formatted_address:  p.formatted_address,
      rating:             p.rating,
      user_ratings_total: p.user_ratings_total,
      types:              p.types,
      opening_hours:      p.opening_hours,
      price_level:        p.price_level,
      geometry:           p.geometry,
      photos:             p.photos?.slice(0, 1),
    }));

    return res.json({ results: places, status });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Place Details ────────────────────────────────────────────────────────────
app.get('/details', async (req, res) => {
  const place_id = (req.query.place_id || '').trim();
  if (!place_id) return res.status(400).json({ error: 'Missing place_id parameter' });

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id,
          key:      KEY,
          language: 'en',
          fields:   'name,formatted_address,rating,user_ratings_total,opening_hours,website,formatted_phone_number,photos,price_level,types,geometry,url',
        },
      }
    );

    const { status, result, error_message } = response.data;
    if (status !== 'OK') {
      return res.status(502).json({ error: error_message || status });
    }

    // Build photo URLs (max 3)
    const photos = (result.photos || []).slice(0, 3).map(p => ({
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${KEY}`,
      attribution: p.html_attributions?.[0] || ''
    }));

    return res.json({
      place_id,
      name:                 result.name,
      formatted_address:    result.formatted_address,
      rating:               result.rating,
      user_ratings_total:   result.user_ratings_total,
      opening_hours:        result.opening_hours,
      website:              result.website,
      phone:                result.formatted_phone_number,
      price_level:          result.price_level,
      types:                result.types,
      geometry:             result.geometry,
      google_maps_url:      result.url,
      photos,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () =>
  console.log(`✅  Japan backend running → http://localhost:${PORT}`)
);
