/**
 * @file Ponto de entrada (entrypoint) da aplicação do painel lateral.
 */

import * as handlers from './handlers.js';

/**
 * Função de inicialização que é executada quando o DOM está completamente carregado.
 */
async function initialize() {
  // Carrega as configurações e o histórico em paralelo no início
  await Promise.all([
    handlers.loadSettings(),
    handlers.loadAndRenderHistory()
  ]);

  const inputBusca = document.getElementById('inputBusca');
  const listaSugestoes = document.getElementById('listaSugestoes');

  // Adiciona gestores de eventos
  inputBusca.addEventListener('keyup', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      handlers.handleSearchInput(event);
    }
  });
  inputBusca.addEventListener('keydown', handlers.handleSuggestionKeydown);

  listaSugestoes.addEventListener('mousedown', (event) => {
    if (event.target && event.target.tagName === 'LI') {
      const index = parseInt(event.target.dataset.idx, 10);
      if (!isNaN(index)) {
        handlers.handleSelectSuggestion(index);
      }
    }
  });

  document.addEventListener('click', (event) => {
    const historyContainer = document.getElementById('history-container');
    if (!listaSugestoes.contains(event.target) && event.target !== inputBusca && !historyContainer.contains(event.target)) {
      listaSugestoes.style.display = 'none';
    }
  });

  document.querySelectorAll('.accordion').forEach((btn) => {
    btn.addEventListener('click', function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;
      panel.classList.toggle('show');
    });
    if (!btn.closest('#sessao-usuario')) { // Mantém secções de dados fechadas por defeito
        btn.classList.remove('active');
        btn.nextElementSibling.classList.remove('show');
    } else {
        btn.classList.add('active');
        btn.nextElementSibling.classList.add('show');
    }
  });

  // Lógica para preencher a busca a partir do menu de contexto
  if (chrome.storage) {
    chrome.storage.local.get('termoBuscaMV', (data) => {
      if (data && data.termoBuscaMV) {
        inputBusca.value = data.termoBuscaMV;
        chrome.storage.local.remove('termoBuscaMV');
        inputBusca.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      }
    });
  }
}

// Garante que o script só é executado após o carregamento completo do DOM.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
