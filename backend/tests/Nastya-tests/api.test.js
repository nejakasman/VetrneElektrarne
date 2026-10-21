const { fetchWeatherData } = require('../../api/api');

describe('fetchWeatherData', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('normalizira Open-Meteo podatke za 10 metrov', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ['2024-01-01T00:00:00Z'],
          wind_speed_10m: [5.5]
        }
      })
    });

    const result = await fetchWeatherData(46.05, 14.5, 'open-meteo-10');

    expect(result).toEqual(expect.objectContaining({
      hourly: {
        time: ['2024-01-01T00:00:00Z'],
        wind: [5.5]
      },
      meta: { actualHeight: 10 }
    }));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('wind_speed_10m'));
  });

  it('izbere parameter za Open-Meteo višino 100 metrov', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ['2024-01-01T00:00:00Z'],
          wind_speed_100m: [8]
        }
      })
    });

    const result = await fetchWeatherData(46, 14, 'open-meteo-100');

    expect(result.meta.actualHeight).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('wind_speed_100m'));
  });

  it('normalizira NASA odgovor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        properties: {
          parameter: {
            WS50M: { '2024010100': 6 }
          }
        }
      })
    });

    const result = await fetchWeatherData(46, 14, 'nasa');

    expect(result.hourly.wind_speed).toEqual([6]);
    expect(result.meta).toEqual({ actualHeight: 50 });
    expect(result.raw.properties.parameter.WS50M['2024010100']).toBe(6);
  });

  it('zavrne Open-Meteo odgovor brez podatkov o hitrosti vetra', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      hourly: {
        time: ['2024-01-01T00:00:00Z']
      }
    })
  });

  await expect(
    fetchWeatherData(46.05, 14.5, 'open-meteo-10')
  ).rejects.toThrow(
    'Open-Meteo vrnil nepričakovane urne podatke'
  );
});

  it('vrne napako pri neuspešnem odzivu ponudnika', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable'
    });

    await expect(fetchWeatherData(46, 14, 'open-meteo'))
      .rejects.toThrow('Open-Meteo vrača napako 503');
  });

  it('vrne napako za neznanega ponudnika', async () => {
    await expect(fetchWeatherData(46, 14, 'unknown-provider'))
      .rejects.toThrow('Neznani provider: unknown-provider');
  });
});
