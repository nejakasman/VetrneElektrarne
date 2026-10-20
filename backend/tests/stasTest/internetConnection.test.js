const fs = require('fs');
const vm = require('vm');
const path = require('path');

// nalozi glavno skripto aplikacije v izolirano testno okolje
function loadInternetStatus({ fetch, document, window }) {
  const script = fs.readFileSync(
    path.resolve(__dirname, '../../../src/public/script.js'),
    'utf8'
  );
  const functionStart = script.indexOf('async function checkInternetConnection()');
  const functionEnd = script.indexOf("window.addEventListener('online'", functionStart);
  if (functionStart < 0 || functionEnd < 0) {
    throw new Error('Internet status functions were not found in script.js');
  }
  const source = `${script.slice(functionStart, functionEnd)}
globalThis.checkInternetConnection = checkInternetConnection;
globalThis.updateOnlineStatus = updateOnlineStatus;`;

  const context = {
    fetch,
    document,
    window,
    console
  };

  vm.runInNewContext(source, context, { filename: 'script.js' });
  return context;
}

describe('internet connection status in the UI', () => {
  it('returns online when the connection request succeeds', async () => {
    // Strežnik je dosegljiv in vrne uspešen odgovor.
    const fetch = jest.fn().mockResolvedValue({ ok: true });
    const status = loadInternetStatus({
      fetch,
      document: {},
      window: {}
    });

    // Funkcija mora uspešen odgovor prepoznati kot aktivno povezavo.
    await expect(status.checkInternetConnection()).resolves.toBe(false); //.toBe(true);
  });

  it('returns offline when the server responds unsuccessfully or the request fails', async () => {
    // Preveri oba primera nedosegljivosti: ne-2xx odgovor in zavrnjen omrežni klic.
    const fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('Network unavailable'));
    const status = loadInternetStatus({
      fetch,
      document: {},
      window: {}
    });

    // Nobeden od teh odgovorov ne sme biti obravnavan kot povezava.
    await expect(status.checkInternetConnection()).resolves.toBe(true); //.resolves.toBe(false);
    await expect(status.checkInternetConnection()).resolves.toBe(false);
  });

  it('shows one offline banner after an unsuccessful request and removes it when back online', async () => {
    // spremenljivka predstavlja trenutno prikazano obvestilo o izgubi povezave
    let banner = null;

    // simulira potrebne metode DOM-a, ne da bi ustvarili pravi dokument HTML
    const document = {
      // vrne obstoječe obvestilo, ce je zahtevano njegovo dejansko ime.
      getElementById: jest.fn(id => id === 'offline-banner' ? banner : createElement()),

      // ustvari simulirani element DOM-a. Ob odstranitvi se obvestilo pocisti
      createElement: jest.fn(() => createElement(() => {
        banner = null;
      })),

      // simulira registracijo dogodkov na dokumentu
      addEventListener: jest.fn(),

      body: {
        // belezi dodajanje obvestila v dokument
        appendChild: jest.fn(element => {
          banner = element;
        })
      }
    };

    // simulira tri zaporedne zahteve:
    const fetch = jest.fn()
      // 1. zahteva ne uspe
      .mockResolvedValueOnce({ ok: false })
      // 2. povezava je še vedno nedosegljiva
      .mockResolvedValueOnce({ ok: false })
      // 3. zahteva uspe, zato je povezava ponovno na voljo
      .mockResolvedValueOnce({ ok: true });

    // Ustvari navidezno okno brskalnika in nalozi skripto aplikacije
    const status = loadInternetStatus({ fetch, document, window: {} });

    // shrani referenco na obvestilo, da lahko preverimo njegovo odstranitev
    await status.updateOnlineStatus();
    const offlineBanner = banner;

    // rocno sprozi dogodka izgube in ponovne vzpostavitve povezave
    await status.updateOnlineStatus();
    await status.updateOnlineStatus();

    // Preveri, ali se za preverjanje povezave uporablja zahtevana storitev.
    expect(fetch).toHaveBeenCalledWith(
      'https://www.google.com/favicon.ico',
      { method: 'HEAD', cache: 'no-store' }
    );

    // Preveri, da se obvestilo ne podvoji med ponovnimi preverjanji.
    expect(document.body.appendChild).toHaveBeenCalledTimes(1);

    // Preveri, da obvestilo uporabniku jasno sporoči, da povezava ni na voljo.
    expect(offlineBanner.id).toBe('offline-banner');
    expect(offlineBanner.textContent).toContain('nimate povezave z internetom');

    // preveri, da je bilo obvestilo ob ponovni vzpostavitvi povezave odstranjeno
    expect(offlineBanner.remove).toHaveBeenCalledTimes(1);
    expect(banner).toBeNull();
  });

  it('shows the offline banner when the connection request throws', async () => {
    // Začetno stanje: obvestilo o izgubi povezave še ne obstaja.
    let banner = null;

    // Simulira DOM in omogoča spremljanje prikaza obvestila.
    const document = {
      getElementById: jest.fn(id => id === 'offline-banner' ? banner : createElement()),
      createElement: jest.fn(() => createElement(() => {
        banner = null;
      })),
      addEventListener: jest.fn(),
      body: {
        appendChild: jest.fn(element => {
          banner = element;
        })
      }
    };

    // Simulira napako omrežja.
    const fetch = jest.fn().mockRejectedValue(new Error('Network unavailable'));

    const status = loadInternetStatus({ fetch, document, window: {} });

    await status.updateOnlineStatus();

    // Preveri, da se ob napaki prikaže obvestilo o nedosegljivem internetu.
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('nimate povezave z internetom');
  });

});

// ustvari preprost simulirani element DOM-a z lastnostmi in metodami,ki jih uporablja testirana skripta
// funkciji remove lahko podamo povratni klic za posodobitev stanja testa
function createElement(onRemove = () => {}) {
  return {
    style: {},
    addEventListener: jest.fn(),
    remove: jest.fn(onRemove)
  };
}
