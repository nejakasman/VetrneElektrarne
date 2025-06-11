const { calculateAnnualEnergy } = require('../calculateAnnualEnergy');

const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

describe('calculateAnnualEnergy', () => {
  const turbineData = {
    speeds: ['3', '5', '10', '15'],
    powers: ['0', '50', '200', '300']
  };

  it('izračuna skupno, tedensko in mesečno energijo pravilno glede na dane podatke o vetru', () => {
    const windData = Array(8760).fill({ wind_speed_100m: '6' });

    const { totalEnergy, weeklyEnergy, monthlyEnergy } = calculateAnnualEnergy(windData, turbineData);

    const expectedTotalEnergy = 80 * 8760;
    expect(totalEnergy).toBeCloseTo(expectedTotalEnergy, 2);

    const expectedWeeklyEnergy = 80 * (7 * 24);
    weeklyEnergy.forEach((week) => {
      expect(week).toBeCloseTo(expectedWeeklyEnergy, 2);
    });

    monthlyEnergy.forEach((month, index) => {
      const expectedMonthlyEnergy = 80 * daysInMonth[index] * 24;
      expect(month).toBeCloseTo(expectedMonthlyEnergy, 2);
    });
  });

  it('vrne nič, če je hitrost vetra pod minimalno ali nad maksimalno vrednostjo', () => {
    const windData = Array(8760).fill({ wind_speed_100m: '2' });

    const { totalEnergy } = calculateAnnualEnergy(windData, turbineData);

    expect(totalEnergy).toBe(0);
  });

  it('pravilno interpolira moč med intervali hitrosti', () => {
    const windData = [{ wind_speed_100m: '4' }];

    const { totalEnergy } = calculateAnnualEnergy(windData, turbineData);

    const expectedPower = 25;
    expect(totalEnergy).toBeCloseTo(expectedPower, 2);
  });
});
