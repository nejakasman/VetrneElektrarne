const { db } = require('../database/db');
const {
  createTurbine,
  readAllTurbines,
  updateTurbine,
  deleteTurbine,
} = require('../turbineService');

// Mockaj db funkcije
jest.mock('../database/db', () => ({
  db: {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  }
}));

describe('TurbineService CRUD', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createTurbine: uspešno doda turbino', async () => {
    // Simuliraj uspešen insert turbine
    db.run.mockImplementationOnce(function (query, params, cb) {
      cb.call({ lastID: 1 }, null);
    });
    // Simuliraj uspešen insert hitrosti
    db.run.mockImplementation(function (query, params, cb) {
      cb(null);
    });

    const turbine = { name: 'TestTurbina', speeds: [3, 5], powers: [100, 200] };
    const result = await createTurbine(turbine);
    expect(result).toEqual({ status: 'success', message: 'Turbina dodana.' });
  });

  it('readAllTurbines: vrne vse turbine', async () => {
    db.all.mockImplementation((query, params, cb) => {
      cb(null, [
        { name: 'T1', speed: 3, power: 100 },
        { name: 'T1', speed: 5, power: 200 },
        { name: 'T2', speed: 4, power: 150 }
      ]);
    });

    const result = await readAllTurbines();
    expect(result).toEqual([
      { name: 'T1', speeds: [3, 5], powers: [100, 200] },
      { name: 'T2', speeds: [4], powers: [150] }
    ]);
  });

  it('updateTurbine: posodobi obstoječo turbino', async () => {
    db.get.mockImplementation((query, params, cb) => cb(null, { id: 1 }));
    db.run.mockImplementation((query, params, cb) => cb(null));

    const updatedTurbine = { name: 'T1', speeds: [3, 5], powers: [110, 210] };
    const result = await updateTurbine(updatedTurbine);
    expect(result).toEqual({ status: 'success', message: 'Turbina posodobljena.' });
  });

  it('deleteTurbine: izbriše turbino', async () => {
    db.run.mockImplementation(function (query, params, cb) {
      cb.call({ changes: 1 }, null);
    });

    const result = await deleteTurbine('T1');
    expect(result).toEqual({ status: 'success', message: 'Turbina izbrisana.' });
  });
});