const { normalizeNasaPower } = require('../../api/suppliers/nasaPower');

describe('normalizeNasaPower', () => {
  it('pretvori NASA meritve v ISO čas in wind_speed', () => {
    const result = normalizeNasaPower({
      properties: {
        parameter: {
          WS50M: {
            '2024010201': 4.5,
            '2024010100': 3,
            '2024010101': null
          }
        }
      }
    });

    expect(result).toEqual({
      hourly: {
        time: [
          '2024-01-01T00:00:00Z',
          '2024-01-01T01:00:00Z',
          '2024-01-02T01:00:00Z'
        ],
        wind_speed: [3, null, 4.5]
      }
    });
  });

  it('podpira nadomestno ime NASA parametra', () => {
    const result = normalizeNasaPower({
      properties: {
        parameter: {
          WS_50M: { '2024010100': '7.25' }
        }
      }
    });

    expect(result.hourly.wind_speed).toEqual([7.25]);
  });

  it('vrne prazna seznama, če ni nobene meritve', () => {
  const result = normalizeNasaPower({
    properties: {
      parameter: {
        WS50M: {}
      }
    }
  });

  expect(result).toEqual({
    hourly: {
      time: [],
      wind_speed: []
    }
  });
});

it('podpira tudi parameter WS50', () => {
  const result = normalizeNasaPower({
    properties: {
      parameter: {
        WS50: {
          '2024010100': 8
        }
      }
    }
  });

  expect(result.hourly.wind_speed).toEqual([8]);
  expect(result.hourly.time).toEqual([
    '2024-01-01T00:00:00Z'
  ]);
});

  it.each([
    [null, 'Odgovor NASA-api v neprimerni obliki'],
    [{ properties: { parameter: {} } }, 'WS50M parameter ni bil najden v odgovoru NASA-api']
  ])('zavrne napako za neveljaven odgovor', (payload, message) => {
    expect(() => normalizeNasaPower(payload)).toThrow(message);
  });
});
