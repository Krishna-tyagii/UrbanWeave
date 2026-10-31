require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/api/config', (req, res) => {
    res.json({
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN || ''
    });
});

app.get('/api/uber-estimate', async (req, res) => {
    try {
        const { startLat, startLng, endLat, endLng } = req.query;
        const UBER_SECRET_KEY = process.env.UBER_API_KEY;

        const uberResponse = await fetch(`https://api.uber.com/v1.2/estimates/price?start_latitude=${startLat}&start_longitude=${startLng}&end_latitude=${endLat}&end_longitude=${endLng}`, {
            headers: {
                'Authorization': `Token ${UBER_SECRET_KEY}`,
                'Accept-Language': 'en_IN'
            }
        });

        const uberData = await uberResponse.json();
        res.json(uberData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch ride estimate' });
    }
});

app.get('/api/flights', async (req, res) => {
    const amadeusKey = process.env.AMADEUS_KEY;
    res.status(501).json({ error: 'Not implemented' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UrbanWeave API Gateway running on port ${PORT}`));
