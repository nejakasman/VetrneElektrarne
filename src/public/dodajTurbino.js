document.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer } = require('electron');
  const form = document.getElementById("turbina-form");

  function naloziTurbine() {
    ipcRenderer.invoke('turbine-read-all').then(turbines => {
      const tabelaContainer = document.getElementById('tabelaContainer');
      tabelaContainer.innerHTML = '';

      const accordion = document.createElement('div');
      accordion.classList.add('accordion');
      accordion.id = 'turbineAccordion';

      turbines.forEach((t, index) => {
        const accordionItem = document.createElement('div');
        accordionItem.classList.add('accordion-item');

        const headerId = `heading${index}`;
        const collapseId = `collapse${index}`;

        const accordionHeader = document.createElement('h2');
        accordionHeader.classList.add('accordion-header');
        accordionHeader.id = headerId;

        const button = document.createElement('button');
        button.classList.add('accordion-button');
        if(index !== 0) button.classList.add('collapsed');
        button.type = 'button';
        button.setAttribute('data-bs-toggle', 'collapse');
        button.setAttribute('data-bs-target', `#${collapseId}`);
        button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
        button.setAttribute('aria-controls', collapseId);
        button.textContent = t.name;

        accordionHeader.appendChild(button);
        accordionItem.appendChild(accordionHeader);

        const accordionCollapse = document.createElement('div');
        accordionCollapse.id = collapseId;
        accordionCollapse.classList.add('accordion-collapse', 'collapse');
        if(index === 0) accordionCollapse.classList.add('show');
        accordionCollapse.setAttribute('aria-labelledby', headerId);
        accordionCollapse.setAttribute('data-bs-parent', '#turbineAccordion');

        const accordionBody = document.createElement('div');
        accordionBody.classList.add('accordion-body', 'side-by-side');

        const actionButtons = document.createElement('div');
        actionButtons.classList.add('mb-3', 'd-flex', 'gap-2');
        actionButtons.innerHTML = `
          <button class="btn custom-btn custom-btn-edit" onclick="uredi('${t.name}')">Uredi</button>
          <button class="btn custom-btn custom-btn-delete" onclick="izbrisi('${t.name}')">Izbriši</button>
        `;
        accordionBody.appendChild(actionButtons);

        const tableSection = document.createElement('div');
        tableSection.classList.add('table-section');

        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-container');

        const table = document.createElement('table');
        table.classList.add('table', 'table-striped', 'table-smaller', 'mb-0');
        table.innerHTML = `
          <thead>
            <tr>
              <th>Hitrost (m/s)</th>
              <th>Moč (kW)</th>
            </tr>
          </thead>
          <tbody>
            ${t.speeds.map((speed, i) => `
              <tr>
                <td>${speed}</td>
                <td>${t.powers[i]}</td>
              </tr>
            `).join('')}
          </tbody>
        `;
        tableContainer.appendChild(table);
        tableSection.appendChild(tableContainer);
        accordionBody.appendChild(tableSection);

        const chartSection = document.createElement('div');
        chartSection.classList.add('chart-section');
        const canvas = document.createElement('canvas');
        chartSection.appendChild(canvas);
        accordionBody.appendChild(chartSection);

        new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: t.speeds,
            datasets: [{
              label: `Moč (${t.name})`,
              data: t.powers,
              borderColor: '#1a3c6d',
              backgroundColor: 'rgba(26, 60, 109, 0.2)',
              fill: true,
              tension: 0.4,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'top' },
            },
            scales: {
              x: { title: { display: true, text: 'Hitrost vetra (m/s)', color: '#1a3c6d' }},
              y: { title: { display: true, text: 'Moč (kW)', color: '#1a3c6d' }},
            }
          }
        });

        accordionCollapse.appendChild(accordionBody);
        accordionItem.appendChild(accordionCollapse);
        accordion.appendChild(accordionItem);
      });

      tabelaContainer.appendChild(accordion);
    });
  }

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

  window.izbrisi = (name) => {
  if (!confirm(`Izbrisati ${name}?`)) return;

  ipcRenderer.invoke('turbine-delete', name)
    .then(() => {
      naloziTurbine();
    })
    .catch(err => {
      alert("Napaka pri brisanju: " + err.message);
      console.error(err);
    });
};


  window.uredi = (name) => {
    ipcRenderer.invoke('turbine-read-all').then(turbines => {
      const turbina = turbines.find(t => t.name === name);
      if (!turbina) return;

      document.getElementById('name').value = turbina.name;
      document.getElementById('speeds').value = turbina.speeds.join(',');
      document.getElementById('powers').value = turbina.powers.join(',');
      const tabTrigger = new bootstrap.Tab(document.querySelector('#add-tab'));
      tabTrigger.show();

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
