const fs = require('fs');
const path = require('path');
function turbineIzJSON(db) { 
  const jsonPath = path.resolve(__dirname, '../database/turbines.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  db.serialize(() => {
    data.forEach(turbina => {
      db.get(`SELECT id FROM Turbine WHERE name = ?`, [turbina.name], (err, row) => {
        if (err) return console.error('Napaka pri iskanju turbine:', err);

        if (row) {
          insertHitrosti(db, row.id, turbina);
        } else {
          db.run(`INSERT INTO Turbine (name) VALUES (?)`, [turbina.name], function(err) {
            if (err) return console.error('Napaka pri vstavljanju turbine:', err);
            insertHitrosti(db, this.lastID, turbina); 
          });
        }
      });
    });
  });
}

function insertHitrosti(db, turbineId, turbina) {
  turbina.speeds.forEach((speed, index) => {
    const power = turbina.powers[index];
    db.run(
      `INSERT INTO Turbine_Hitrosti (turbine_id, speed, power) VALUES (?, ?, ?)`,
      [turbineId, parseFloat(speed), parseInt(power)],
      err => {
        if (err) console.error('Napaka pri vstavljanju hitrosti/moči:', err);
      }
    );
  });
}

module.exports = { turbineIzJSON };
