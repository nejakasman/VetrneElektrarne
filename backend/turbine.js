const { db } = require('../database/db');

const { ipcMain } = require('electron');

const { findOrFetchWeatherData } = require('../src/public/vnosVBazo');
const { getTurbineSpeeds } = require('./getTurbineSpeeds');
const { calculateAnnualEnergy } = require('./calculateAnnualEnergy');



//CREATE
ipcMain.handle('turbine-create', (event, turbine) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO Turbine (name) VALUES (?)`,
      [turbine.name],
      function(err) {
        if (err) {
          return reject({ status: 'error', message: err.message });
        }

        // Vstavljanje hitrosti
        const turbineId = this.lastID;
        const insertSpeeds = turbine.speeds.map((speed, i) => {
          return new Promise((resolveSpeed, rejectSpeed) => {
            db.run(
              `INSERT INTO Turbine_Hitrosti (turbine_id, speed, power) VALUES (?, ?, ?)`,
              [turbineId, parseFloat(speed), parseInt(turbine.powers[i])],
              err => {
                if (err) return rejectSpeed(err);
                resolveSpeed();
              }
            );
          });
        });

        Promise.all(insertSpeeds)
          .then(() => resolve({ status: 'success', message: 'Turbina dodana.' }))
          .catch(err => reject({ status: 'error', message: err.message }));
      }
    );
  });
});

//READ
ipcMain.handle('turbine-read-all', () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT t.name, h.speed, h.power
      FROM Turbine t
      LEFT JOIN Turbine_Hitrosti h ON t.id = h.turbine_id
    `, [], (err, rows) => {
      if (err) return reject({ status: 'error', message: err.message });

      const grouped = {};
      rows.forEach(row => {
        if (!grouped[row.name]) {
          grouped[row.name] = { name: row.name, speeds: [], powers: [] };
        }
        grouped[row.name].speeds.push(row.speed);
        grouped[row.name].powers.push(row.power);
      });

      resolve(Object.values(grouped));
    });
  });
});

//UPDATE
ipcMain.handle('turbine-update', (event, updatedTurbine) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id FROM Turbine WHERE name = ?`, [updatedTurbine.name], (err, row) => {
      if (err || !row) {
        return reject({ status: 'error', message: 'Turbina ni najdena.' });
      }

      const turbineId = row.id;

      db.run(`DELETE FROM Turbine_Hitrosti WHERE turbine_id = ?`, [turbineId], err => {
        if (err) return reject({ status: 'error', message: err.message });

        const insertSpeeds = updatedTurbine.speeds.map((speed, i) => {
          return new Promise((resolveSpeed, rejectSpeed) => {
            db.run(
              `INSERT INTO Turbine_Hitrosti (turbine_id, speed, power) VALUES (?, ?, ?)`,
              [turbineId, parseFloat(speed), parseInt(updatedTurbine.powers[i])],
              err => {
                if (err) return rejectSpeed(err);
                resolveSpeed();
              }
            );
          });
        });

        Promise.all(insertSpeeds)
          .then(() => resolve({ status: 'success', message: 'Turbina posodobljena.' }))
          .catch(err => reject({ status: 'error', message: err.message }));
      });
    });
  });
});

//DELETE
ipcMain.handle('turbine-delete', (event, name) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM Turbine WHERE name = ?`, [name], function(err) {
      if (err) {
        return reject(new Error(err.message));
      }
      if (this.changes === 0) {
        return reject(new Error('Turbina ni najdena.'));
      }
      resolve({ status: 'success', message: 'Turbina izbrisana.' });
    });
  });
});

ipcMain.handle('weather-fetch', async (event, { latitude, longitude }) => {
  try {
    const data = await findOrFetchWeatherData(latitude, longitude);
    return { status: 'success', data };
  } catch (err) {
    console.error('Napaka v weather-fetch:', err);
    return { status: 'error', message: err.message };
  }
});


ipcMain.handle('turbine-get-speeds', (event, { turbineName }) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM Turbine WHERE name = ?", [turbineName], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve([]);

      const turbineId = row.id;

      db.all("SELECT speed, power FROM Turbine_Hitrosti WHERE turbine_id = ?", [turbineId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
});

ipcMain.handle('calculate-annual-energy', async (event, { windData, turbineName }) => {
  try {
    const turbineData = await getTurbineSpeeds(turbineName);
    // console.log("Podatki o turbini:", turbineData);

    if (!turbineData || turbineData.speeds.length === 0) throw new Error("Ni podatkov o turbini.");

    const { totalEnergy, weeklyEnergy, monthlyEnergy } = calculateAnnualEnergy(windData, turbineData);

    return { status: 'success', totalEnergy, weeklyEnergy, monthlyEnergy };
  } catch (error) {
    console.error("Napaka pri izračunu letne energije:", error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('save-calculation-history', async (event, { latitude, longitude, turbineName, annualEnergy, weeklyEnergy }) => {
  try {

    let lokacijaId;
    const locRow = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM Lokacija WHERE latitude = ? AND longitude = ?", [latitude, longitude], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (locRow) {
      lokacijaId = locRow.id;
    } else {
      throw new Error("Lokacija ne obstaja v bazi.");
    }


    const turbineRow = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM Turbine WHERE name = ?", [turbineName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!turbineRow) throw new Error("Turbina ne obstaja.");
    const turbineId = turbineRow.id;


    await new Promise((resolve, reject) => {
      const now = new Date();
      const isoDate = now.toISOString(); 
      db.run(
        `INSERT INTO Zgodovina_Izracunov
         (lokacija_id, turbine_id, letna_energija, tedenska_energija, datum)
         VALUES (?, ?, ?, ?, ?)`,
        [lokacijaId, turbineId, annualEnergy, JSON.stringify(weeklyEnergy), isoDate],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
      });


    return { status: "success" };
  } catch (err) {
    console.error("Napaka pri shranjevanju Zgodovina_Izracunov:", err);
    return { status: "error", message: err.message };
  }
});

ipcMain.handle('get-calculation-history', async () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT ch.id, ch.letna_energija, ch.tedenska_energija, ch.datum,
             l.latitude, l.longitude, t.name AS turbine_name
      FROM Zgodovina_Izracunov ch
      JOIN Lokacija l ON ch.lokacija_id = l.id
      JOIN Turbine t ON ch.turbine_id = t.id
      ORDER BY ch.datum DESC
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});
