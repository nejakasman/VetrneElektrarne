const { getTurbineSpeeds } = require('../getTurbineSpeeds');
const { db } = require('../database/db');

jest.mock('../database/db', () => {
  return {
    db: {
      get: jest.fn(),
      all: jest.fn()
    }
  };
});

describe('getTurbineSpeeds', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('vrne hitrosti in moči za veljavno turbino', async () => {
    db.get.mockImplementation((poizvedba, parametri, klic) => {
      klic(null, { id: 1 });
    });

    db.all.mockImplementation((poizvedba, parametri, klic) => {
      klic(null, [
        { speed: 3.5, power: 100 },
        { speed: 5.0, power: 200 }
      ]);
    });

    const rezultat = await getTurbineSpeeds('VeljavnaTurbina');

    expect(rezultat).toEqual({
      speeds: [3.5, 5.0],
      powers: [100, 200]
    });

    expect(db.get).toHaveBeenCalledWith(
      'SELECT id FROM Turbine WHERE name = ?',
      ['VeljavnaTurbina'],
      expect.any(Function)
    );

    expect(db.all).toHaveBeenCalledWith(
      expect.any(String),
      [1],
      expect.any(Function)
    );
  });

  it('vrne objekt s praznima poljema hitrosti in moči, če turbina ni najdena', async () => {
    db.get.mockImplementation((poizvedba, parametri, klic) => {
      klic(null, null);
    });

    const rezultat = await getTurbineSpeeds('NeObstojecaTurbina');

    expect(rezultat).toEqual({ speeds: [], powers: [] });

    expect(db.get).toHaveBeenCalledWith(
      'SELECT id FROM Turbine WHERE name = ?',
      ['NeObstojecaTurbina'],
      expect.any(Function)
    );

    expect(db.all).not.toHaveBeenCalled();
  });

  it('vrže napako, če pride do napake z bazo', async () => {
    db.get.mockImplementation((poizvedba, parametri, klic) => {
      klic(new Error('Napaka baze'), null);
    });

    await expect(getTurbineSpeeds('NapacnaTurbina')).rejects.toThrow('Napaka baze');

    expect(db.get).toHaveBeenCalledWith(
      'SELECT id FROM Turbine WHERE name = ?',
      ['NapacnaTurbina'],
      expect.any(Function)
    );

    expect(db.all).not.toHaveBeenCalled();
  });
});
