const { db } = require('../database/db');

const { ipcMain } = require('electron');

const { findOrFetchWeatherData } = require('../src/public/vnosVBazo');



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
        return reject({ status: 'error', message: err.message });
      }
      if (this.changes === 0) {
        return resolve({ status: 'error', message: 'Turbina ni najdena.' });
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
