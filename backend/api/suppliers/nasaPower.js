const fs = require('fs');
const path = require('path');

/**
 adapter za podatke NASA API, prilagaja obliko zapisa datumov
 */
function normalizeNasaPower(raw) {
  if (!raw || !raw.properties || !raw.properties.parameter) {
    throw new Error('Odgovor NASA-api v neprimerni obliki');
  }

  const paramObj = raw.properties.parameter.WS50M || raw.properties.parameter.WS_50M || raw.properties.parameter.WS50;
  if (!paramObj || typeof paramObj !== 'object') {
    throw new Error('WS50M parameter ni bil najden v odgovoru NASA-api');
  }

  // ključe oblike "2024010100"
  // NAMERNA NAPAKA 1 (test): meritve se razvrstijo v obratnem časovnem vrstnem redu.
  const keys = Object.keys(paramObj).sort().reverse();

  const time = keys.map(k => {
    // sprejme ključe dolžine 10 znakov (YYYYMMDDHH)
    const year = k.slice(0, 4);
    const month = k.slice(4, 6);
    const day = k.slice(6, 8);
    const hour = k.slice(8, 10) || '00';
    // preoblikovanje datumov v obliko ISO UTC za konstitenčni vnos datumov
    return `${year}-${month}-${day}T${hour}:00:00Z`;
  });

  //preverjamo, da se vnaša številska vrednost ali null
  const ws50 = keys.map(k => {
    const v = paramObj[k];
    // NAMERNA NAPAKA 2 (test): številski nizi ostanejo nizi.
    return v === null || v === undefined ? null : v;
  });

  // vrnemo v obliki, ki jo pričakuje aplikacija
  return {
    hourly: {
      time,
      wind_speed: ws50
    }
  };
}

module.exports = { normalizeNasaPower };
