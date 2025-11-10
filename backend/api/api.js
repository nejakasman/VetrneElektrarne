const fs = require('fs');
const path = require('path');
const { normalizeNasaPower } = require('./suppliers/nasaPower');

/**
 * enotni fetchWeatherData entrypoint za aplikacijo.
 * Podpira več ponudnikov. Oblika:
 *   fetchWeatherData(latitude, longitude, provider = 'nasa', height = 50)
 */
async function fetchWeatherData(latitude, longitude, provider = 'open-meteo') {
  const prov = (provider || 'open-meteo').toLowerCase();

  if (prov === 'nasa') {
    const params = {
      latitude,
      longitude,
      start: '20240101',
      end: '20241231',
      parameter: 'WS50M',
      community: 'RE',
      format: 'JSON'
    };

    const baseUrl = 'https://power.larc.nasa.gov/api/temporal/hourly/point';
    const url = `${baseUrl}?parameters=${params.parameter}&community=${params.community}&longitude=${params.longitude}&latitude=${params.latitude}&start=${params.start}&end=${params.end}&time-standard=UTC&format=${params.format}`;

    console.log('Request URL (NASA):', url);

    try {
      const response = await fetch(url);
      const text = await response.text();

      if (!response.ok) {
        console.error('NASA API napaka:', text);
        throw new Error(`NASA API vrača napako: ${response.status}`);
      }

      let raw;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        console.error('Odgovor JSON (NASA) v neprimerni obliki:', text.slice(0, 200));
        throw e;
      }

  // Normalize but also return the original raw payload so callers can keep the original structure
  const normalized = normalizeNasaPower(raw);
  return { hourly: normalized.hourly, meta: { actualHeight: 50 }, raw };
    } catch (error) {
      console.error('Napaka v fetchWeatherData (NASA):', error);
      throw error;
    }
  }

  if (prov === 'open-meteo' || prov.startsWith('open-meteo-')) {
  const lat = latitude;
  const lon = longitude;
    const start = '2024-01-01';
    const end = '2024-12-31';

  // obdelava višine iz imena ponudnika (10m ali 100m)
    let requested = 10;
    if (prov.startsWith('open-meteo-')) {
      const suffix = prov.split('-')[2];
      if (suffix === '100') requested = 100;
      else if (suffix === '10') requested = 10;
    }
    const hourlyParam = requested === 100 ? 'wind_speed_100m' : 'wind_speed_10m';

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&hourly=${hourlyParam}&wind_speed_unit=ms`;

    console.log('Request URL (Open-Meteo):', url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const txt = await response.text();
        console.error('Open-Meteo napaka:', txt.slice(0, 300));
        throw new Error(`Open-Meteo vrača napako ${response.status}`);
      }

      const data = await response.json();

      if (!data.hourly || !Array.isArray(data.hourly.time) || !Array.isArray(data.hourly[hourlyParam])) {
        throw new Error('Open-Meteo vrnil nepričakovane urne podatke');
      }

      // normalizacija za nadaljno uporabo
      const result = {
        hourly: {
          time: data.hourly.time,
          wind: data.hourly[hourlyParam]
        },
        meta: { actualHeight: requested },
        raw: data
      };

      return result;
    } catch (err) {
      console.error('Napaka v fetchWeatherData (Open-Meteo):', err);
      throw err;
    }
  }

  throw new Error(`Neznani provider: ${provider}`);
}

module.exports = { fetchWeatherData };
