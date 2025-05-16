const { initDatabase } = require('../database/db');
const { turbineIzJSON } = require('../database/podatkiTurbine');
const { db } = require('../database/db');


initDatabase();
turbineIzJSON();

setTimeout(() => {
  db.all(`SELECT t.name, h.speed, h.power
          FROM Turbine t
          JOIN Turbine_Hitrosti h ON t.id = h.turbine_id`, [], (err, rows) => {
    if (err) {
      console.error("Napaka pri poizvedbi:", err.message);
    } else {
      console.log("Podatki o turbinah in hitrostih:");
      console.table(rows);
    }

    db.close();
  });
}, 1000);
