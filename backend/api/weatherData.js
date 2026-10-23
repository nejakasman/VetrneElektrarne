const { db } = require('../database/db');
const geolib = require('geolib');
const { fetchWeatherData } = require('./api');

/**
 * poiščemo shranjene meritve za bližnjo lokacijo ali pridobimo od ponudnika.
 */
async function findOrFetchWeatherData(latitude, longitude, provider = 'open-meteo', height = 10, forceFetch = false) {
  return new Promise((resolve, reject) => {
    const latNum = Number(latitude);
    const lonNum = Number(longitude);

    //Normalizacija ponudnika in željene višine

    const provParam = (provider || 'open-meteo').toLowerCase();
    let providerBase = provParam;
    let desiredHeight = Number(height) || 10;
    if (provParam.startsWith('open-meteo-')) {
      providerBase = 'open-meteo';
      const parts = provParam.split('-');
      const suffix = parts[2];
      if (suffix === '100') desiredHeight = 100;
      else desiredHeight = 10;
    } else if (provParam === 'open-meteo') {
      providerBase = 'open-meteo';
      desiredHeight = Number(height) || 10;
    } else if (provParam === 'nasa') {
      providerBase = 'nasa';
      desiredHeight = 50;
    }

    db.all("SELECT id, latitude, longitude FROM Lokacija", [], (err, rows) => {
      if (err) return reject(err);

      // poišče prvo lokacaijo znotraj 500m
      const nearbyLocation = rows.find(row => {
        const rowLat = Number(row.latitude);
        const rowLon = Number(row.longitude);
        if (!Number.isFinite(rowLat) || !Number.isFinite(rowLon)) return false;
        return geolib.getDistance(
          { latitude: latNum, longitude: lonNum },
          { latitude: rowLat, longitude: rowLon }
        ) <= 500;
      });

      // SQL za poizvedbo shranjenih meritev za to lokacijo/ponudnika/višino
      function queryStored(lokacijaId, cb) {
        const sql = `SELECT datum AS datetime, wind_speed, height_m, provider
                     FROM Veter
                     WHERE lokacija_id = ? AND provider = ? AND height_m = ?
                     ORDER BY datum`;
        db.all(sql, [lokacijaId, providerBase, desiredHeight], (qErr, measurements) => {
          if (qErr) return cb(qErr);
          cb(null, measurements || []);
        });
      }

      if (nearbyLocation) {
        queryStored(nearbyLocation.id, (qErr, measurements) => {
          if (qErr) return reject(qErr);
          // če imamo že podatke shranjene, vrnemo podatke iz baze
          if (measurements.length > 0 && !forceFetch) {
            const first = measurements[0] || {};
            const usedProvider = first.provider || providerBase;
            const usedHeight = first.height_m != null ? Number(first.height_m) : desiredHeight;
            return resolve({ measurements, lokacija_id: nearbyLocation.id, provider: usedProvider, height: usedHeight });
          }
          // če ni shranjenih podatkov, za to lokacijo ID pridobimo podatke o vetru od željenega ponudnika
          fetchAndStore(nearbyLocation.id);
        });
      } else {
        // ni meritev -> shranimo vse na novo
        fetchAndStore(null);
      }

      // fetchanje in shranjevanje podatkov
      async function fetchAndStore(existingLokacijaId) {
        try {
          const data = await fetchWeatherData(latNum, lonNum, provider);
          if (!data || !data.hourly || !Array.isArray(data.hourly.time)) {
            return reject(new Error('Adapter vrnil data.hourly.time v nepravilni obliki'));
          }

          let windArr = Array.isArray(data.hourly.wind) ? data.hourly.wind : null;
          const times = data.hourly.time;
          const actualHeight = data.meta && data.meta.actualHeight ? Number(data.meta.actualHeight) : Number(desiredHeight);
          const rawProvider = data.raw || null;

          if (!windArr) {
            for (const k of Object.keys(data.hourly)) {
              if (k === 'time') continue;
              if (/wind/i.test(k) && Array.isArray(data.hourly[k]) && data.hourly[k].length === times.length) {
                windArr = data.hourly[k];
                break;
              }
            }
          }

          if (!windArr) {
            return reject(new Error('Adapter ni ponudil hourly.wind in ni bilo možno najti drugih podatkov'));
          }

          // preverimo da lokacija obstaja
          let lokacija_id = existingLokacijaId;
          if (!lokacija_id) {
            await new Promise((res, rej) => {
              db.run("INSERT INTO Lokacija (latitude, longitude) VALUES (?, ?)", [latNum, lonNum], function(insErr) {
                if (insErr) return rej(insErr);
                lokacija_id = this.lastID;
                res();
              });
            });
          }

          // gradimo objekte meritev in povežemo v obliko : single wind_speed + height_m
          const measurements = times.map((time, idx) => {
            const raw = windArr[idx];
            return {
              datetime: time,
              wind_speed: raw != null ? Number(raw) : null,
              height_m: actualHeight,
              provider: providerBase
            };
          });

          // vstavljamo v bazo (INSERT OR REPLACE da izognemo težavam z unique index)
          const insertSql = `INSERT OR REPLACE INTO Veter (lokacija_id, datum, wind_speed, height_m, provider)
                             VALUES (?, ?, ?, ?, ?)`;
          const stmt = db.prepare(insertSql);
          db.serialize(() => {
            for (const m of measurements) {
              stmt.run([lokacija_id, m.datetime, m.wind_speed, m.height_m, m.provider], runErr => {
                if (runErr) console.error('Napaka pri vstvljanju v tabelo Veter:', runErr);
              });
            }
            //SQLite lovljenje napak
            stmt.finalize(finalizeErr => {
              if (finalizeErr) {
                console.error('Finalize stmt napaka:', finalizeErr);
                return reject(finalizeErr);
              }
              resolve({ measurements, lokacija_id, provider: providerBase, height: actualHeight, raw: rawProvider });
            });
          });
        } catch (fetchErr) {
          console.error('Napaka pri pridobivanju/shranjevanju weather data:', fetchErr);
          reject(fetchErr);
        }
      }
    });
  });
}

module.exports = { findOrFetchWeatherData };
