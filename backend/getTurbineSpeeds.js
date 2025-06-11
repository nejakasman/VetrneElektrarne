const { db } = require('./database/db');

function getTurbineSpeeds(turbineName) {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM Turbine WHERE name = ?", [turbineName], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve({ speeds: [], powers: [] });

      const turbineId = row.id;

      const query = `
        SELECT CAST(speed AS REAL) AS speed, power
        FROM Turbine_Hitrosti
        WHERE turbine_id = ?
        ORDER BY speed ASC
      `;

      db.all(query, [turbineId], (err, rows) => {
        if (err) return reject(err);

        const speeds = [];
        const powers = [];

        rows.forEach(({ speed, power }) => {
          speeds.push(parseFloat(speed)); // Pretvori v številko, če še ni
          powers.push(parseFloat(power));
        });

        resolve({ speeds, powers });
      });
    });
  });
}

module.exports = { getTurbineSpeeds };
