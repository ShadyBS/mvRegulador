/**
 * Guarda as opções no chrome.storage.
 * @param {Event} e - O evento de submissão do formulário.
 */
function saveOptions(e) {
    e.preventDefault();
    const itemsPerPage = document.getElementById('itemsPerPage').value;
  
    // Guarda as configurações usando chrome.storage.sync para sincronizar entre dispositivos
    chrome.storage.sync.set({
      settings: {
        itemsPerPage: parseInt(itemsPerPage, 10) || 15 // Valor padrão de 15 se for inválido
      }
    }, () => {
      // Exibe uma mensagem de confirmação para o utilizador
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
    // Pede ao chrome.storage.sync as configurações guardadas
    chrome.storage.sync.get({
      settings: {
        itemsPerPage: 15 // Define valores padrão se não houver nada guardado
      }
    }, (data) => {
      document.getElementById('itemsPerPage').value = data.settings.itemsPerPage;
    });
  }
  
  // Adiciona os event listeners quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('settings-form').addEventListener('submit', saveOptions);
  