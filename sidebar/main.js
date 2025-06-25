/**
 * @file Ponto de entrada (entrypoint) da aplicação do painel lateral.
 * Responsável por inicializar a aplicação e adicionar os gestores de eventos globais.
 */

import * as handlers from './handlers.js';

/**
 * Função de inicialização que é executada quando o DOM está completamente carregado.
 */
function initialize() {
  const inputBusca = document.getElementById('inputBusca');
  const listaSugestoes = document.getElementById('listaSugestoes');

  // Adiciona gestor de eventos para a barra de pesquisa
  inputBusca.addEventListener('keyup', (event) => {
    // A navegação por setas é tratada no keydown para melhor responsividade
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      handlers.handleSearchInput(event);
    }
  });
  inputBusca.addEventListener('keydown', handlers.handleSuggestionKeydown);

  // Adiciona gestor de eventos para cliques na lista de sugestões (delegação de eventos)
  listaSugestoes.addEventListener('mousedown', (event) => {
    if (event.target && event.target.tagName === 'LI') {
      const index = parseInt(event.target.dataset.idx, 10);
      if (!isNaN(index)) {
        handlers.handleSelectSuggestion(index);
      }
    }
  });

  // Esconde a lista de sugestões se clicar fora dela
  document.addEventListener('click', (event) => {
    if (!listaSugestoes.contains(event.target) && event.target !== inputBusca) {
      listaSugestoes.style.display = 'none';
    }
  });

  // Inicializa os 'accordions' para as secções
  document.querySelectorAll('.accordion').forEach((btn) => {
    btn.addEventListener('click', function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;
      panel.classList.toggle('show');
    });
    // Abre todos por defeito
    btn.classList.add('active');
    btn.nextElementSibling.classList.add('show');
  });

  // Lógica para preencher a busca a partir do menu de contexto
  if (chrome.storage) {
    chrome.storage.local.get('termoBuscaMV', (data) => {
      if (data && data.termoBuscaMV) {
        inputBusca.value = data.termoBuscaMV;
        chrome.storage.local.remove('termoBuscaMV');
        // Dispara o evento 'keyup' para simular a digitação e iniciar a busca
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
