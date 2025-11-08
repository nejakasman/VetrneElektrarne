const { db } = require('./database/db');

const { ipcMain } = require('electron');

const { findOrFetchWeatherData } = require('./api/weatherData');
const { getTurbineSpeeds } = require('./getTurbineSpeeds');
const { calculateAnnualEnergy } = require('./calculateAnnualEnergy');
const { createTurbine, readAllTurbines, updateTurbine, deleteTurbine } = require('./turbineService');

ipcMain.handle('turbine-create', (event, turbine) => createTurbine(turbine));
ipcMain.handle('turbine-read-all', () => readAllTurbines());
ipcMain.handle('turbine-update', (event, updatedTurbine) => updateTurbine(updatedTurbine));
ipcMain.handle('turbine-delete', (event, name) => deleteTurbine(name));



ipcMain.handle('weather-fetch', async (event, { latitude, longitude }) => {
  try {
    const { measurements, lokacija_id } = await findOrFetchWeatherData(latitude, longitude);
    return { status: 'success', data: measurements, lokacija_id };
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

ipcMain.handle('calculate-annual-energy', async (event, { windData, turbineName, useCSV }) => {
  try {
    const turbineData = await getTurbineSpeeds(turbineName);
    if (!turbineData || turbineData.speeds.length === 0)
      throw new Error("Ni podatkov o turbini.");

    let dataToUse = [];
    let source = "api"; 

    if (useCSV) { //samo če uporabnik izbere CSV
      const csvRows = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM Veter_CSV", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (csvRows.length === 0) {
        throw new Error("CSV tabela je prazna.");
      }

      console.log(`✅ Uporabljam ${csvRows.length} vrstic iz CSV datoteke.`);
      dataToUse = csvRows.map(r => ({
        wind_speed_100m: r.wind_speed,
        datum: r.datum
      }));

      source = "csv";
    } else {
      console.log(`🌐 Uporabljam podatke iz API.`);
      dataToUse = windData;
    }

    const { totalEnergy, weeklyEnergy, monthlyEnergy } =
      calculateAnnualEnergy(dataToUse, turbineData);

    return {
      status: "success",
      totalEnergy,
      weeklyEnergy,
      monthlyEnergy,
      source
    };
  } catch (error) {
    console.error("❌ Napaka pri izračunu letne energije:", error);
    return { status: "error", message: error.message };
  }
});



ipcMain.handle('save-calculation-history', async (event, data) => {
  const { lokacija_id, turbineName, annualEnergy, weeklyEnergy, monthlyEnergy, windData } = data;

  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id FROM Turbine WHERE name = ?",
      [turbineName],
      (err, turbRow) => {
        if (err) return reject(err);
        if (!turbRow) return reject(new Error("Turbina ne obstaja v bazi."));

        const now = new Date();
        const isoDate = now.toISOString(); 

        db.run(
          `INSERT INTO Zgodovina_Izracunov 
            (lokacija_id, turbine_id, letna_energija, tedenska_energija, mesecna_energija, wind_data, datum)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            lokacija_id,
            turbRow.id,
            annualEnergy,
            JSON.stringify(weeklyEnergy),
            JSON.stringify(monthlyEnergy),
            JSON.stringify(windData),
            isoDate
          ],
          function (err) {
            if (err) return reject(err);
            resolve({ status: "success" });
          }
        );
      }
    );
  });
});
ipcMain.handle('get-calculation-history', async () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        Zgodovina_Izracunov.id,
        Lokacija.latitude,
        Lokacija.longitude,
        Turbine.name AS turbine_name,
        Zgodovina_Izracunov.letna_energija,
        Zgodovina_Izracunov.tedenska_energija,
        Zgodovina_Izracunov.mesecna_energija,
        Zgodovina_Izracunov.wind_data,
        Zgodovina_Izracunov.datum
      FROM Zgodovina_Izracunov
      JOIN Lokacija ON Zgodovina_Izracunov.lokacija_id = Lokacija.id
      JOIN Turbine ON Zgodovina_Izracunov.turbine_id = Turbine.id
      ORDER BY Zgodovina_Izracunov.datum DESC
      `,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
});

//Logika za shranjevanje CSV
ipcMain.handle("import-csv", async (event, csvData) => {
  try {
    const insert = db.prepare(`
      INSERT INTO Veter_CSV (datum, wind_speed, height, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      for (const row of csvData) {
        insert.run(row.datum, row.wind_speed, row.height, row.latitude, row.longitude);
      }
      db.run("COMMIT");
    });

    insert.finalize();
    console.log(`✅ CSV uspešno uvožen (${csvData.length} vrstic).`);

    return { status: "success", count: csvData.length };
  } catch (error) {
    console.error("❌ Napaka pri shranjevanju CSV:", error);
    return { status: "error", message: error.message };
  }
});