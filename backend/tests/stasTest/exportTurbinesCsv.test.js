const fs = require('fs');

// Shrani registrirane IPC-obravnavalce, da jih lahko neposredno pokličemo v testih.
const mockIpcHandlers = new Map();

// mockan modul Electron in beleži registracijo IPC-obravnavalcev.
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockIpcHandlers.set(channel, handler))
  }
}));

// mocka metode baze podatkov, da testi ne dostopajo do dejanske baze.
jest.mock('../../database/db', () => ({
  db: {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
  }
}));

// mocka zunanje module, ki jih uporabljajo obravnavalci Electron.
jest.mock('../../api/weatherData', () => ({ findOrFetchWeatherData: jest.fn() }));
jest.mock('../../getTurbineSpeeds', () => ({ getTurbineSpeeds: jest.fn() }));
jest.mock('../../calculateAnnualEnergy', () => ({ calculateAnnualEnergy: jest.fn() }));
jest.mock('../../turbineService', () => ({
  createTurbine: jest.fn(),
  readAllTurbines: jest.fn(),
  updateTurbine: jest.fn(),
  deleteTurbine: jest.fn()
}));

// Uvozi funkcijo za branje vetrnih turbin in registrira IPC-obravnavalce.
const { readAllTurbines } = require('../../turbineService');
require('../../electronHandlers');

describe('exporting turbines as CSV', () => {
  // Pridobi obravnavalca za izvoz turbin v CSV in omogoči njegov neposreden klic.
  const exportCsv = (...args) => mockIpcHandlers.get('export-turbines-csv')(...args);

  beforeEach(() => {
    // Pred vsakim testom počisti zgodovino klicev posmehljivih funkcij.
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Po vsakem testu obnovi prvotne implementacije prestreženih funkcij.
    jest.restoreAllMocks();
  });

  it('writes rows with escaped names and localized decimal separators', async () => {
    // Pripravi testno turbino z narekovaji v imenu, decimalnimi vrednostmi in manjkajočo vrednostjo moči.
    readAllTurbines.mockResolvedValue([{
      name: 'Turbine "A"',
      speeds: [3.5, 4],
      powers: [120.5, null]
    }]);

    // Posnema ustvarjanje imenika in zapis datoteke brez poseganja v datotečni sistem.
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    // Preveri, ali izvoz vrne uspešno stanje in pravilno pot do datoteke.
    await expect(exportCsv(null, { filePath: '/exports/turbines.csv' }))
      .resolves.toEqual({ status: 'success', filePath: '/exports/turbines.csv' });

    // Preveri vsebino CSV-datoteke:
    // - stolpci so ločeni s podpičji,
    // - narekovaji v imenih so podvojeni,
    // - decimalne pike so zamenjane z vejicami,
    // - manjkajoča vrednost moči ostane prazna,
    // - datoteka je zapisana s kodiranjem UTF-8.
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/exports/turbines.csv',
      'turbine_name;speed;power\n"Turbine ""A""";3,5;120,5\n"Turbine ""A""";4;\n',
      'utf8'
    );
  });

  it('exports only the header when there are no turbines', async () => {
    // Simulira primer, ko v bazi ni shranjenih nobenih turbin.
    readAllTurbines.mockResolvedValue([]);

    // Posnema operacije z datotečnim sistemom.
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    // Zažene izvoz praznega seznama turbin.
    await exportCsv(null, { filePath: '/exports/empty.csv' });

    // Preveri, da CSV vsebuje samo glavo stolpcev in nobene podatkovne vrstice.
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/exports/empty.csv',
      'turbine_name;speed;power\n',
      'utf8'
    );
  });

  it('returns an error when the selected CSV path is missing', async () => {
    // Brez izbrane poti izvoz ne sme poskušati prebrati ali zapisati podatkov.
    // Preveri, ali izvoz vrne ustrezno napako, kadar pot za shranjevanje ni podana.
    await expect(exportCsv(null, {})).resolves.toEqual({
      status: 'error',
      message: 'Ni podane poti za shranjevanje.'
    });

    expect(readAllTurbines).not.toHaveBeenCalled();
  });

  it('returns an error when reading turbine data fails', async () => {
    // Branje podatkov turbine iz storitve se konča z napako.
    readAllTurbines.mockRejectedValue(new Error('Turbine read failed'));

    // Izvoz mora vrniti napako branja, namesto da bi ustvaril navidezno uspešen rezultat.
    await expect(exportCsv(null, { filePath: '/exports/turbines.csv' })).resolves.toEqual({
      status: 'error',
      message: 'Turbine read failed'
    });
  });

  it('returns an error when writing the CSV file fails', async () => {
    // Pripravi turbino, da se lahko test osredotoči na napako pri zapisovanju datoteke.
    readAllTurbines.mockResolvedValue([{ name: 'T1', speeds: [3], powers: [100] }]);

    // Posnema ustvarjanje imenika in povzroči napako pri zapisu CSV-datoteke.
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('Disk unavailable');
    });

    // Napaka datotečnega sistema se mora vrniti v rezultatu izvoza.
    // Preveri, ali se napaka pri zapisovanju pravilno vrne klicatelju.
    await expect(exportCsv(null, { filePath: '/exports/turbines.csv' })).resolves.toEqual({
      status: 'error',
      message: 'Disk unavailable'
    });
  });

});
