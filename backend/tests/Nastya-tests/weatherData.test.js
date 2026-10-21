jest.mock('../../database/db', () => ({
  db: {
    all: jest.fn(),
    run: jest.fn(),
    prepare: jest.fn(),
    serialize: jest.fn(callback => callback())
  }
}));

jest.mock('../../api/api', () => ({
  fetchWeatherData: jest.fn()
}));

const { db } = require('../../database/db');
const { fetchWeatherData } = require('../../api/api');
const { findOrFetchWeatherData } = require('../../api/weatherData');

describe('findOrFetchWeatherData', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('vrne shranjene meritve za bližnjo lokacijo brez klica API-ja', async () => {
    db.all
      .mockImplementationOnce((query, params, callback) => {
        callback(null, [{ id: 7, latitude: 46.05, longitude: 14.5 }]);
      })
      .mockImplementationOnce((query, params, callback) => {
        callback(null, [
          {
            datetime: '2024-01-01T00:00:00Z',
            wind_speed: 5,
            height_m: 100,
            provider: 'open-meteo'
          }
        ]);
      });

    const result = await findOrFetchWeatherData(46.0501, 14.5001, 'open-meteo-100');

    expect(result).toEqual({
      measurements: [
        {
          datetime: '2024-01-01T00:00:00Z',
          wind_speed: 5,
          height_m: 100,
          provider: 'open-meteo'
        }
      ],
      lokacija_id: 7,
      provider: 'open-meteo',
      height: 100
    });
    expect(fetchWeatherData).not.toHaveBeenCalled();

    // Preverimo, da aplikacija najprej poišče lokacijo v bazi.
    expect(db.all).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Lokacija'),
      [],
      expect.any(Function)
    );

    // Preverimo, da je aplikacija opravila dve poizvedbi v bazi.
    expect(db.all).toHaveBeenCalledTimes(2);
        expect(db.all).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('height_m = ?'),
          [7, 'open-meteo', 100],
          expect.any(Function)
        );
      });

  it('pridobi in shrani sveže meritve za novo lokacijo', async () => {
    fetchWeatherData.mockResolvedValue({
      hourly: {
        time: ['2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z'],
        wind: [4, 6]
      },
      meta: { actualHeight: 10 },
      raw: { source: 'test' }
    });

    db.all.mockImplementationOnce((query, params, callback) => callback(null, []));
    db.run.mockImplementationOnce(function (query, params, callback) {
      callback.call({ lastID: 12 }, null);
    });

    const statement = {
      run: jest.fn((params, callback) => callback(null)),
      finalize: jest.fn(callback => callback(null))
    };
    db.prepare.mockReturnValue(statement);

    const result = await findOrFetchWeatherData(46.05, 14.5, 'open-meteo');

    expect(result).toEqual({
      measurements: [
        {
          datetime: '2024-01-01T00:00:00Z',
          wind_speed: 4,
          height_m: 10,
          provider: 'open-meteo'
        },
        {
          datetime: '2024-01-01T01:00:00Z',
          wind_speed: 6,
          height_m: 10,
          provider: 'open-meteo'
        }
      ],
      lokacija_id: 12,
      provider: 'open-meteo',
      height: 10,
      raw: { source: 'test' }
    });
    // Preverimo, da sta obe meritvi shranjeni s pravilnimi podatki.
    expect(statement.run).toHaveBeenNthCalledWith(
      1,
      [12, '2024-01-01T00:00:00Z', 4, 10, 'open-meteo'],
      expect.any(Function)
    );

    expect(statement.run).toHaveBeenNthCalledWith(
      2,
      [12, '2024-01-01T01:00:00Z', 6, 10, 'open-meteo'],
      expect.any(Function)
    );

    expect(statement.finalize).toHaveBeenCalledTimes(1);
  });

  it('zavrne napako, če ponudnik ne vrne hitrosti vetra', async () => {
    fetchWeatherData.mockResolvedValue({
      hourly: {
        time: ['2024-01-01T00:00:00Z']
      }
    });
    db.all.mockImplementationOnce((query, params, callback) => callback(null, []));

    await expect(findOrFetchWeatherData(46.05, 14.5, 'nasa'))
      .rejects.toThrow('Adapter ni ponudil hourly.wind');
    expect(db.run).not.toHaveBeenCalled();
  });
});
