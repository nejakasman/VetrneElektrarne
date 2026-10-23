const fs = require('fs');

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

// Posnema odvisne module, ki jih uporabljajo obravnavalci Electron.
jest.mock('../../api/weatherData', () => ({ findOrFetchWeatherData: jest.fn() }));
jest.mock('../../getTurbineSpeeds', () => ({ getTurbineSpeeds: jest.fn() }));
jest.mock('../../calculateAnnualEnergy', () => ({ calculateAnnualEnergy: jest.fn() }));
jest.mock('../../turbineService', () => ({
  createTurbine: jest.fn(),
  readAllTurbines: jest.fn(),
  updateTurbine: jest.fn(),
  deleteTurbine: jest.fn()
}));

// Uvozi funkcijo za branje turbin in registrira IPC-obravnavalce.
const { readAllTurbines } = require('../../turbineService');
require('../../electronHandlers');

describe('exporting turbines as JSON', () => {
  // Pridobi obravnavalca za izvoz podatkov turbin v JSON.
  const exportJson = (...args) => mockIpcHandlers.get('export-turbines')(...args);

  beforeEach(() => {
    // Pred vsakim testom počisti zgodovino klicev posmehljivih funkcij.
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Po vsakem testu obnovi prvotne implementacije prestreženih funkcij.
    jest.restoreAllMocks();
  });

  it('writes all turbine data as pretty-printed JSON to the selected path', async () => {
    // Pripravi testne podatke ene turbine z njenimi hitrostmi in močmi.
    const turbines = [{ name: 'T1', speeds: [3, 5], powers: [100, 200] }];

    // Simulira uspešno pridobivanje podatkov o turbinah.
    readAllTurbines.mockResolvedValue(turbines);

    // Posnema ustvarjanje imenika in zapis datoteke brez poseganja v datotečni sistem.
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    // Preveri, ali izvoz vrne uspešno stanje in pravilno pot do datoteke.
    await expect(exportJson(null, { filePath: '/exports/turbines.json' }))
    .resolves.toEqual({ status: 'success', filePath: '/exports/turbines.json' });

    // Preveri natančno vsebino in oblikovanje izpisane datoteke.
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/exports/turbines.json',
      '[\n  {\n    "name": "T1",\n    "speeds": [\n      3,\n      5\n    ],\n    "powers": [\n      100,\n      200\n    ]\n  }\n]',
      'utf8'
    );
  });

  it('returns an error when no JSON output path is supplied', async () => {
    // Preveri, ali se vrne ustrezna napaka, kadar pot za shranjevanje ni podana.
    await expect(exportJson(null, {})).resolves.toEqual({
      status: 'error',
      message: 'Ni podane poti za shranjevanje.'
    });

    // Preveri, da se podatki turbin ne berejo, če manjka pot za izvoz.
    expect(readAllTurbines).not.toHaveBeenCalled();
  });

  it('returns an error when the turbine data cannot be read', async () => {
    // Simulira napako pri pridobivanju podatkov o turbinah.
    readAllTurbines.mockRejectedValue(new Error('Turbine read failed'));

    // Preveri, ali izvoz pravilno vrne sporočilo napake in stanje error.
    await expect(exportJson(null, { filePath: '/exports/turbines.json' })).resolves.toEqual({
      status: 'error',
      message: 'Turbine read failed'
    });
  });

  it('returns an error when writing the JSON file fails', async () => {
    // Branje turbine uspe, vendar zapis datoteke odpove.
    readAllTurbines.mockResolvedValue([{ name: 'T1', speeds: [3], powers: [100] }]);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Disk unavailable');
    });

    // Rezultat izvoza mora opisati napako pri pisanju.
    await expect(exportJson(null, { filePath: '/exports/turbines.json' })).resolves.toEqual({
      status: 'error',
      message: 'Disk unavailable'
    });
  });

});
