const { randomUUID } = require("crypto");
const { db } = require('./database/db');

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const { findOrFetchWeatherData } = require('./api/weatherData');
const { getTurbineSpeeds } = require('./getTurbineSpeeds');
const { calculateAnnualEnergy } = require('./calculateAnnualEnergy');
const { createTurbine, readAllTurbines, updateTurbine, deleteTurbine } = require('./turbineService');

ipcMain.handle('turbine-create', (event, turbine) => createTurbine(turbine));
ipcMain.handle('turbine-read-all', () => readAllTurbines());
ipcMain.handle('turbine-update', (event, updatedTurbine) => updateTurbine(updatedTurbine));
ipcMain.handle('turbine-delete', (event, name) => deleteTurbine(name));

// izvoz podatkov o turbinah v JSON datoteko
ipcMain.handle('export-turbines', async (event, { filePath } = {}) => {
  try {
    if (!filePath) throw new Error('Ni podane poti za shranjevanje.');
    const turbines = await readAllTurbines();
    const dir = path.dirname(filePath);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
    fs.writeFileSync(filePath, JSON.stringify(turbines, null, 2), 'utf8');
    console.log('turbine izvožene:', filePath);
    return { status: 'success', filePath };
  } catch (err) {
    console.error('Napaka pri izvozu turbin:', err);
    return { status: 'error', message: err.message };
  }
});

// izvoz podatkov o turbinah v CSV datoteko
ipcMain.handle('export-turbines-csv', async (event, { filePath } = {}) => {
  try {
    if (!filePath) throw new Error("Ni podane poti za shranjevanje.");

    const turbines = await readAllTurbines();
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    // CSV header 
    let csv = "turbine_name;speed;power\n";

    for (const t of turbines) {
      const name = t.name.replace(/"/g, '""'); // podvoji " v imenu
      const nameEscaped = `"${name}"`;

      for (let i = 0; i < t.speeds.length; i++) {
        const speed = String(t.speeds[i]).replace('.', ',');
        const power = t.powers[i] != null ? String(t.powers[i]).replace('.', ',') : "";

        csv += `${nameEscaped};${speed};${power}\n`;
      }
    }

    // Shrani CSV
    fs.writeFileSync(filePath, csv, "utf8");

    console.log("CSV uspešno izvožen:", filePath);
    return { status: "success", filePath };

  } catch (err) {
    console.error("Napaka pri izvozu turbin CSV:", err);
    return { status: "error", message: err.message };
  }
});





ipcMain.handle('weather-fetch', async (event, { 
  latitude, 
  longitude, 
  provider, 
  saveJsonPath, 
  saveCsvPath } = {}) => {
  try {
    // Če je podan ponudnik, ka uporabimo. findOrFetchWeatherData default open-meteo.
  // if caller requested saving raw provider data, force a fresh fetch so we have the original raw response
  const forceFetch = Boolean(saveJsonPath || saveCsvPath);
  const { measurements, lokacija_id, provider: usedProvider, height: usedHeight, raw } = 
  await findOrFetchWeatherData(latitude, longitude, provider, undefined, forceFetch);

    // JSON export
    if (saveJsonPath && raw) {
      try {
        const dir = path.dirname(saveJsonPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(saveJsonPath, JSON.stringify(raw, null, 2), 'utf8');
      } catch (e) {
        console.warn("Failed to save JSON:", e.message);
      }
    }

    // CSV EXPORT
if (saveCsvPath && raw) {
  try {
    const dir = path.dirname(saveCsvPath);
    fs.mkdirSync(dir, { recursive: true });

    const rows = convertRawToCsvRows(raw);

    if (!rows || rows.length === 0) {
      throw new Error("Ni vrstic za CSV.");
    }

    const SEP = ";";

    const headers = Object.keys(rows[0]).join(SEP);

    const csvRows = rows.map(r =>
      Object.values(r)
        .map(v => {
          if (typeof v === "number") {
            return v.toString().replace(".", ",");
          }
          return v ?? "";
        })
        .join(SEP)
    );

    const csvContent = headers + "\n" + csvRows.join("\n");

    fs.writeFileSync(saveCsvPath, csvContent, "utf8");

  } catch (e) {
    console.warn("Failed to save CSV:", e.message);
  }
}



    return { status: 'success',
            data: measurements, 
            lokacija_id, 
            provider: usedProvider, 
            height: usedHeight 
          };

      } catch (err) {
    console.error('Napaka v weather-fetch:', err);
    return { status: 'error', message: err.message };
  }
});

//Branje podatkov iz CSV namesto API
ipcMain.handle("weather-fetch-csv", async (event, { latitude, longitude }) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT datum, wind_speed, height, latitude, longitude
         FROM Veter_CSV
         WHERE latitude = ? AND longitude = ?
           AND batch_id = (SELECT batch_id FROM Veter_CSV ORDER BY id DESC LIMIT 1)
         ORDER BY datum ASC`,
        [latitude, longitude],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (rows.length === 0) {
      return { status: "error", message: "Ni CSV podatkov za to lokacijo." };
    }

    return {
      status: "success",
      data: rows.map(r => ({
        datetime: r.datum,
        wind_speed: r.wind_speed,
        height: r.height,
        latitude: r.latitude,
        longitude: r.longitude
      })),
      provider: "CSV datoteka 📄",
      height: rows[0].height || null
    };
  } catch (err) {
    console.error("❌ Napaka pri branju CSV podatkov:", err);
    return { status: "error", message: err.message };
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

ipcMain.handle('calculate-annual-energy', async (event, { windData, turbineName, useCSV, correctionFactor = 1.0 }) => {
  try {
    const turbineData = await getTurbineSpeeds(turbineName);
    if (!turbineData || turbineData.speeds.length === 0)
      throw new Error("Ni podatkov o turbini.");

    let dataToUse = [];
    let source = "api"; 

    if (useCSV) { //samo če uporabnik izbere CSV
      const csvRows = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM Veter_CSV WHERE batch_id = (SELECT batch_id FROM Veter_CSV ORDER BY id DESC LIMIT 1)", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (csvRows.length === 0) {
        throw new Error("CSV tabela je prazna.");
      }

      console.log(`Uporabljam ${csvRows.length} vrstic iz CSV datoteke.`);
      dataToUse = csvRows.map(r => ({
        wind_speed: r.wind_speed,
        datum: r.datum
      }));

      source = "csv";
    } else {
      console.log(`🌐 Uporabljam podatke iz API.`);

      dataToUse = windData.map(d => {
    const corrected = { ...d };
    for (const key of Object.keys(corrected)) {
      if (
        key.toLowerCase().includes("wind_speed") ||
        key.toLowerCase().includes("ws")
      ) {
        const val = parseFloat(corrected[key]);
        if (!isNaN(val)) corrected[key] = val * correctionFactor;
      }
    }

    return corrected;
      });
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
    console.error("Napaka pri izračunu letne energije:", error);
    return { status: "error", message: error.message };
  }
});



ipcMain.handle('save-calculation-history', async (event, data) => {
  const { lokacija_id, turbineName, annualEnergy, weeklyEnergy, monthlyEnergy, windData, provider, height } = data;

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
            (lokacija_id, turbine_id, letna_energija, tedenska_energija, mesecna_energija, wind_data, height_m, provider, datum)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lokacija_id,
            turbRow.id,
            annualEnergy,
            JSON.stringify(weeklyEnergy),
            JSON.stringify(monthlyEnergy),
            JSON.stringify(windData),
            height || null,
            provider || null,
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
          Zgodovina_Izracunov.height_m,
          Zgodovina_Izracunov.provider,
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

    const batch_id = randomUUID(); //za generiranje id serije

    const insert = db.prepare(`
      INSERT INTO Veter_CSV (datum, wind_speed, height, latitude, longitude, batch_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      for (const row of csvData) {
        insert.run(row.datum, row.wind_speed, row.height, row.latitude, row.longitude, batch_id);
      }
      db.run("COMMIT");
    });

    insert.finalize();
    console.log(`✅ CSV uspešno uvožen (${csvData.length} vrstic) - batch_id: ${batch_id}`);

    return { status: "success", count: csvData.length, batch_id };
  } catch (error) {
    console.error("❌ Napaka pri shranjevanju CSV:", error);
    return { status: "error", message: error.message };
  }
});

  ipcMain.handle("ensure-csv-location", async (event, { latitude, longitude }) => {
  try {
    const id = await ensureCsvLocation(latitude, longitude);
    return id;
  } catch (e) {
    console.error("Napaka pri ensure-csv-location:", e);
    throw e;
  }
});

function convertRawToCsvRows(raw) {
  console.log("NASA RAW KEYS:", Object.keys(raw.properties?.parameter?.WS50M || {}));

  if (!raw) return [];

  //Open-Meteo
  if (raw.hourly && typeof raw.hourly === "object") {
    const hourly = raw.hourly;
    const keys = Object.keys(hourly);
    const len = Math.max(...keys.map(k => hourly[k].length || 0));

    const rows = [];
    for (let i = 0; i < len; i++) {
      const row = {};
      for (const key of keys) {
        row[key] = hourly[key][i] ?? null;
      }
      rows.push(row);
    }
    return rows;
  }

  
      // NASA Power
  if (raw.properties?.parameter?.WS50M) {
  const wsObj = raw.properties.parameter.WS50M;

  console.log("NASA RAW KEYS:", Object.keys(wsObj));

  const rows = Object.keys(wsObj)
    .sort()
    .map(key => {
      const val = wsObj[key];

      if (/^\d{10}$/.test(key)) {
        const year = key.slice(0, 4);
        const month = key.slice(4, 6);
        const day = key.slice(6, 8);
        const hour = key.slice(8, 10);

        const date = `${year}-${month}-${day}`;
        const time = `${hour}:00`;

        return {
          date,
          time,
          wind_speed_50m: val
        };
      }

      if (/^\d{4}$/.test(key)) {
        const hour = key.slice(0, 2);
        const minute = key.slice(2, 4);

        return {
          date: "",
          time: `${hour}:${minute}`,
          wind_speed_50m: val
        };
      }

      if (/^\d{2}$/.test(key)) {
        return {
          date: "",
          time: `${key}:00`,
          wind_speed_50m: val
        };
      }
      // fallback
      return {
        date: "",
        time: key,
        wind_speed_50m: val
      };
    });

  return rows;
}
  //fallback - vrni prazen niz
  if (Array.isArray(raw)) {
    return raw;
  }

  return [];
}

function ensureCsvLocation(lat, lon) {
  return new Promise((resolve, reject) => {
    // preverjanje za obstoj lokacije
    db.get(
      "SELECT id FROM Lokacija WHERE latitude = ? AND longitude = ?",
      [lat, lon],
      (err, row) => {
        if (err) return reject(err);

        if (row) {
          return resolve(row.id); // lokacija že obstaja
        }
        
        db.run(
          "INSERT INTO Lokacija (latitude, longitude) VALUES (?, ?)",
          [lat, lon],
          function (err2) {
            if (err2) return reject(err2);
            resolve(this.lastID);
          }
        );
      }
    );
  });
}

