// Shrani registrirane IPC-obravnavalce, da jih lahko neposredno pokličemo v testih.
const mockIpcHandlers = new Map();

// Posnema modul Electron in shrani obravnavalce ob njihovi registraciji.
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockIpcHandlers.set(channel, handler))
  }
}));

// Posnema metode baze podatkov, da testi ne dostopajo do dejanske baze.
jest.mock('../../database/db', () => ({
  db: {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
  }
}));

// Posnema dodatne module, ki jih uporabljajo obravnavalci Electron.
jest.mock('../../api/weatherData', () => ({ findOrFetchWeatherData: jest.fn() }));
jest.mock('../../getTurbineSpeeds', () => ({ getTurbineSpeeds: jest.fn() }));
jest.mock('../../calculateAnnualEnergy', () => ({ calculateAnnualEnergy: jest.fn() }));
jest.mock('../../turbineService', () => ({
  createTurbine: jest.fn(),
  readAllTurbines: jest.fn(),
  updateTurbine: jest.fn(),
  deleteTurbine: jest.fn()
}));

// Uvozi posnemano bazo in registrira IPC-obravnavalce iz glavne datoteke.
const { db } = require('../../database/db');
require('../../electronHandlers');

describe('calculation history', () => {
  // Omogoča neposreden klic obravnavalca za shranjevanje zgodovine izračunov.
  const saveHistory = (...args) => mockIpcHandlers.get('save-calculation-history')(...args);

  // Omogoča neposreden klic obravnavalca za pridobivanje zgodovine izračunov.
  const getHistory = (...args) => mockIpcHandlers.get('get-calculation-history')(...args);

  beforeEach(() => {
    // Pred vsakim testom počisti zgodovino klicev posmehljivih funkcij.
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves calculation values for an existing turbine', async () => {
    // Pripravi podatke izračuna, ki jih je treba shraniti v zgodovino.
    const calculation = {
      lokacija_id: 5,
      turbineName: 'T1',
      annualEnergy: 1200,
      weeklyEnergy: [100, 200],
      monthlyEnergy: [300],
      windData: [{ wind_speed: 4 }],
      provider: 'open-meteo',
      height: 10
    };

    // Simulira uspešno iskanje turbine v bazi in vrne njen ID.
    db.get.mockImplementation((query, params, callback) => callback(null, { id: 8 }));

    // Simulira uspešno shranjevanje zapisa v bazo.
    db.run.mockImplementation((query, params, callback) => callback(null));
    jest.useFakeTimers().setSystemTime(new Date('2025-04-03T12:30:00.000Z'));

    // Preveri, ali se izračun za obstoječo turbino uspešno shrani.
    await expect(saveHistory(null, calculation)).resolves.toEqual({ status: 'success' });

    // Preveri vrednosti, posredovane poizvedbi za shranjevanje:
    // lokacijo, ID turbine, letno energijo, serializirane podatke,
    // višino, ponudnika podatkov in časovni žig.
    expect(db.run.mock.calls[0][1]).toEqual([
      5,
      8,
      1200,
      '[100,200]',
      '[300]',
      '[{"wind_speed":4}]',
      10,
      'open-meteo',
      '2025-04-03T12:30:00.000Z'
    ]);
  });

  it('rejects saving history when the named turbine does not exist', async () => {
    // Simulira uspešno izvedeno poizvedbo, ki ne najde zahtevane turbine.
    db.get.mockImplementation((query, params, callback) => callback(null, undefined));

    // Preveri, ali se shranjevanje zavrne z ustreznim sporočilom,
    // kadar turbina ne obstaja v bazi.
    await expect(saveHistory(null, { turbineName: 'Missing turbine' }))
      .rejects.toThrow('Turbina ne obstaja v bazi.');

    // Preveri, da se zapis v bazo ne izvede, če turbine ni mogoče najti.
    expect(db.run).not.toHaveBeenCalled();
  });

  it('rejects saving history when the database fails', async () => {
    // Simulira napako baze pri iskanju turbine.
    db.get.mockImplementation((query, params, callback) => callback(new Error('Database unavailable')));

    // Preveri, ali se napaka baze pravilno posreduje klicatelju.
    await expect(saveHistory(null, { turbineName: 'T1' }))
      .rejects.toThrow('Database unavailable');
  });

  it('rejects saving history when inserting the calculation fails', async () => {
    // Turbina obstaja, vendar vstavljanje njenega izračuna v zgodovino ne uspe.
    db.get.mockImplementation((query, params, callback) => callback(null, { id: 8 }));
    db.run.mockImplementation((query, params, callback) => callback(new Error('Insert failed')));

    // Napaka pri zapisu se mora vrniti klicatelju.
    await expect(saveHistory(null, { turbineName: 'T1' }))
      .rejects.toThrow('Insert failed');
  });

  it('returns saved calculations when history loading succeeds', async () => {
    // Pripravi primer zapisa zgodovine, ki ga vrne baza podatkov.
    const records = [{ id: 4, turbine_name: 'T1', letna_energija: 1200 }];

    // Simulira uspešno pridobivanje zapisov zgodovine.
    db.all.mockImplementation((query, params, callback) => callback(null, records));

    // Preveri, ali obravnavalec vrne vse zapise, ki jih je vrnila baza.
    await expect(getHistory()).resolves.toEqual(records);
  });

  it('rejects loading history when the database fails', async () => {
    // Simulira napako pri branju zgodovine iz baze.
    db.all.mockImplementation((query, params, callback) => callback(new Error('Read failed')));

    // Preveri, ali se napaka pri branju pravilno posreduje klicatelju.
    await expect(getHistory()).rejects.toThrow('Read failed');
  });

});
