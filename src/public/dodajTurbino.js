document.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer } = require('electron');
  const form = document.getElementById("turbina-form");

  function naloziTurbine() {
    ipcRenderer.invoke('turbine-read-all').then(turbines => {
      const seznam = document.getElementById('seznamTurbin');
      seznam.innerHTML = '';

      turbines.forEach(t => {
        const item = document.createElement('li');
        item.classList.add('list-group-item');
        item.innerHTML = `
          <strong>${t.name}</strong><br>
          Hitrosti: ${t.speeds.join(', ')}<br>
          Moči: ${t.powers.join(', ')}<br>
          <button class="btn btn-danger btn-sm mt-2 me-2" onclick="izbrisi('${t.name}')">Izbriši</button>
          <button class="btn btn-secondary btn-sm mt-2" onclick="uredi('${t.name}')">Uredi</button>
        `;
        seznam.appendChild(item);
      });
    });
  }

  // dodajanje trubin
  const originalSubmit = function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const speeds = document.getElementById('speeds').value.split(',').map(s => s.trim());
    const powers = document.getElementById('powers').value.split(',').map(p => p.trim());

    const turbina = { name, speeds, powers };

    ipcRenderer.invoke('turbine-create', turbina).then(() => {
      form.reset();
      naloziTurbine();
    }).catch(err => {
      alert("Napaka: " + err.message);
    });
  };

  form.onsubmit = originalSubmit;

  // brisanje
  window.izbrisi = (name) => {
    if (!confirm(`Izbrisati ${name}?`)) return;

    ipcRenderer.invoke('turbine-delete', name).then(() => {
      naloziTurbine();
    });
  };

  // urejanje
  window.uredi = (name) => {
    ipcRenderer.invoke('turbine-read-all').then(turbines => {
      const turbina = turbines.find(t => t.name === name);
      if (!turbina) return;

      document.getElementById('name').value = turbina.name;
      document.getElementById('speeds').value = turbina.speeds.join(',');
      document.getElementById('powers').value = turbina.powers.join(',');

      // vstavljanje podatkov v obrazec za urejanje
      form.onsubmit = function (e) {
        e.preventDefault();

        const speeds = document.getElementById('speeds').value.split(',').map(s => s.trim());
        const powers = document.getElementById('powers').value.split(',').map(p => p.trim());

        const updated = { name: turbina.name, speeds, powers };

        ipcRenderer.invoke('turbine-update', updated).then(() => {
          form.reset();
          form.onsubmit = originalSubmit;
          naloziTurbine();
        }).catch(err => {
          alert("Napaka pri urejanju: " + err.message);
          console.error("Napaka urejanja:", err);
        });
      };
    });
  };

  naloziTurbine();
});
