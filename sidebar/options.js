/**
 * Guarda as opções no chrome.storage.
 * @param {Event} e - O evento de submissão do formulário.
 */
function saveOptions(e) {
  e.preventDefault();
  const itemsPerPage = document.getElementById('itemsPerPage').value;
  const prontuarioPeriodoPadrao = document.getElementById('prontuarioPeriodoPadrao').value;

  chrome.storage.sync.set({
    settings: {
      itemsPerPage: parseInt(itemsPerPage, 10) || 15,
      prontuarioPeriodoPadrao: prontuarioPeriodoPadrao || 'last_year'
    }
  }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Configurações guardadas com sucesso!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
}

/**
 * Restaura as opções guardadas e preenche o formulário.
 */
function restoreOptions() {
  chrome.storage.sync.get({
    settings: {
      itemsPerPage: 15,
      prontuarioPeriodoPadrao: 'last_year'
    }
  }, (data) => {
    document.getElementById('itemsPerPage').value = data.settings.itemsPerPage;
    document.getElementById('prontuarioPeriodoPadrao').value = data.settings.prontuarioPeriodoPadrao;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('settings-form').addEventListener('submit', saveOptions);
