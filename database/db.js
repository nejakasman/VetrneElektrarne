const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, './vetrneElektrarne.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Napaka pri povezavi z bazo:', err.message);
    } else {
        console.log('Povezan z SQLite bazo.');
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
        wind_speed_10m DECIMAL(5,2),
        wind_speed_100m DECIMAL(5,2),
        FOREIGN KEY (lokacija_id) REFERENCES Lokacija(id) ON DELETE CASCADE
      )
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

    // db.run(`
    //   CREATE TABLE EnergijskaVrednost (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     lokacija_id INTEGER,
    //     turbine_id INTEGER,
    //     datum DATETIME,
    //     speed FLOAT,
    //     energy FLOAT,
    //     FOREIGN KEY (lokacija_id) REFERENCES Lokacija(id) ON DELETE CASCADE,
    //     FOREIGN KEY (turbine_id) REFERENCES Turbine(id) ON DELETE CASCADE
    //   )
    // `);
  });
}

module.exports = { db, initDatabase };
initDatabase();
