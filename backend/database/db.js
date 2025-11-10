const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const { turbineIzJSON } = require('./turbinesDb');

const dbPath = path.join(app.getPath('userData'), 'vetrneElektrarne.db');
// const dbPath = path.join(__dirname, 'vetrneElektrarne.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Napaka pri povezavi z bazo:', err.message);
    } else {
        console.log('Povezan z SQLite bazo.');
        console.log('Lokalna pot do baze:', dbPath);
    }
});



function initDatabase() {
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");

    db.run(`
      CREATE TABLE IF NOT EXISTS Lokacija (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        longitude TEXT NOT NULL,
        latitude TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Veter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        datum TEXT NOT NULL,
        lokacija_id INTEGER NOT NULL,
        wind_speed DECIMAL(5,2),
        height_m INTEGER,
        provider TEXT NOT NULL,
        FOREIGN KEY (lokacija_id) REFERENCES Lokacija(id) ON DELETE CASCADE
      )
    `);
    
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS veter_loc_date_provider_height
      ON Veter (lokacija_id, datum, provider, height_m)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Turbine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Turbine_Hitrosti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turbine_id INTEGER NOT NULL,
        speed DECIMAL(5,2),
        power INTEGER,
        FOREIGN KEY (turbine_id) REFERENCES Turbine(id) ON DELETE CASCADE
      )
    `);

    // Tabela za podatke iz CSV datotek
    db.run(`
      CREATE TABLE IF NOT EXISTS Veter_CSV (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        datum TEXT NOT NULL,
        wind_speed REAL NOT NULL,
        height INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        batch_id TEXT NOT NULL
      )
    `);


    

    db.run(`
      CREATE TABLE IF NOT EXISTS Zgodovina_Izracunov (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
        lokacija_id INTEGER,
        turbine_id INTEGER,
        letna_energija REAL,
        tedenska_energija TEXT,
        mesecna_energija TEXT,
        wind_data TEXT,
        height_m INTEGER,
        datum DATETIME DEFAULT CURRENT_TIMESTAMP,
        provider TEXT,
        FOREIGN KEY (lokacija_id) REFERENCES Lokacija(id) ON DELETE CASCADE,
        FOREIGN KEY (turbine_id) REFERENCES Turbine(id) ON DELETE CASCADE
      )
    `);

        db.get("SELECT COUNT(*) as count FROM Turbine", (err, row) => {
      if (!err && row.count === 0) {
        turbineIzJSON(db);
      }
    });
  });
}

module.exports = { db, initDatabase };
initDatabase();
