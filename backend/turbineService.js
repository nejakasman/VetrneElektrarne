const { db } = require('./database/db');

//CREATE
function createTurbine(turbine) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO Turbine (name) VALUES (?)`,
      [turbine.name],
      function(err) {
        if (err) {
          return reject({ status: 'error', message: err.message });
        }

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
};

//READ
function  readAllTurbines() {
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
};

//UPDATE
function  updateTurbine(updatedTurbine) {
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
};

//DELETE
function  deleteTurbine(name) {
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
};

module.exports = {
  createTurbine,
  readAllTurbines,
  updateTurbine,
  deleteTurbine,

};