/**
 * Japan Trip Finder — Node.js / Express Backend
 * Proxies requests to Google Places API (Text Search)
 *
 * Setup:
 *   1. npm install
 *   2. Create a .env file with your GOOGLE_API_KEY (see .env.example)
 *   3. node server.js  (or: npx nodemon server.js for dev)
 *
 * Endpoint:
 *   GET /search?query=ramen+in+Shibuya
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

// Allow requests from your frontend (adjust origin for production)
app.use(cors({ origin: '*' }));

/**
 * GET /search?query=...
 * Returns up to 20 Places results for a text query.
 */
app.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query,
          key:      KEY,
          language: 'en',
          // Bias results toward Japan
          location: '36.2048,138.2529',
          radius:   500000,
        },
      }
    );

    const { status, results, error_message } = response.data;

    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      console.error('Places API error:', status, error_message);
      return res.status(502).json({ error: error_message || status });
    }

    // Shape the response for the frontend
    const places = (results || []).map(p => ({
      place_id:            p.place_id,
      name:                p.name,
      formatted_address:   p.formatted_address,
      rating:              p.rating,
      user_ratings_total:  p.user_ratings_total,
      types:               p.types,
      opening_hours:       p.opening_hours,
      price_level:         p.price_level,
      geometry:            p.geometry,
      photos:              p.photos?.slice(0, 1),  // first photo ref only
      icon:                p.icon,
    }));

    return res.json({ results: places, status });

  } catch (err) {
    console.error('Request failed:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () =>
  console.log(`✅  Japan backend running → http://localhost:${PORT}`)
);
