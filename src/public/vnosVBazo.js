const { db } = require('../../database/db');
const geolib = require('geolib');
const { fetchWeatherData } = require('./pridobi-veter');


async function findOrFetchWeatherData(latitude, longitude) {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, latitude, longitude FROM Lokacija", [], (err, rows) => {
      if (err) return reject(err);

      const nearbyLocation = rows.find(row => {
        return geolib.getDistance(
          { latitude, longitude },
          { latitude: row.latitude, longitude: row.longitude }
        ) <= 9000;
      });

      if (nearbyLocation) {
        db.all(
          "SELECT datum AS datetime, wind_speed_10m, wind_speed_100m FROM Veter WHERE lokacija_id = ?",
          [nearbyLocation.id],
          (err, measurements) => {
            if (err) return reject(err);
            resolve({ measurements, lokacija_id: nearbyLocation.id });
          }
        );
      } else {
        fetchWeatherData(latitude, longitude)
          .then(data => {
            db.run(
              "INSERT INTO Lokacija (latitude, longitude) VALUES (?, ?)",
              [latitude, longitude],
              function(err) {
                if (err) return reject(err);
                const lokacija_id = this.lastID;

                const measurements = data.hourly.time.map((time, index) => ({
                  datetime: time,
                  wind_speed_10m: data.hourly.wind_speed_10m[index],
                  wind_speed_100m: data.hourly.wind_speed_100m[index]
                }));

                const insertPromises = measurements.map(m => {
                  return new Promise((resolve, reject) => {
                    db.run(
                      "INSERT INTO Veter (lokacija_id, datum, wind_speed_10m, wind_speed_100m) VALUES (?, ?, ?, ?)",
                      [
                        lokacija_id,
                        m.datetime,
                        m.wind_speed_10m,
                        m.wind_speed_100m
                      ],
                      err => {
                        if (err) {
                          console.error('Error inserting into Veter:', err);
                          return reject(err);
                        }
                        resolve();
                      }
                    );
                  });
                });

                Promise.all(insertPromises)
                  .then(() => resolve({ measurements, lokacija_id }))
                  .catch(err => {
                    console.error('Error inserting measurements:', err);
                    reject(err);
                  });
              }
            );
          })
          .catch(err => {
            console.error('Error fetching weather data:', err);
            reject(err);
          });
      }
    });
  });
}


module.exports = { findOrFetchWeatherData };
