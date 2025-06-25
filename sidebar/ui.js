/**
 * @file Módulo de UI.
 * Contém todas as funções responsáveis por manipular o DOM, renderizar
 * HTML e controlar elementos visuais da interface.
 */

/**
 * Renderiza a lista de sugestões de pesquisa.
 * @param {Array<string[]>} suggestions - A lista de sugestões vinda do estado.
 */
export function renderSuggestions(suggestions) {
    const listElement = document.getElementById('listaSugestoes');
    listElement.innerHTML = '';
  
    if (suggestions.length > 0) {
      suggestions.forEach((row, idx) => {
        const li = document.createElement('li');
        li.textContent = `${row[5]} - ${row[6] || ''} - ${row[7]}`;
        li.dataset.idx = idx;
        listElement.appendChild(li);
      });
      listElement.style.display = 'block';
    } else {
      listElement.style.display = 'none';
    }
  }
  
  /**
   * Atualiza o destaque visual na lista de sugestões.
   * @param {number} index - O índice da sugestão a ser destacada.
   */
  export function updateSuggestionSelection(index) {
    const listElement = document.getElementById('listaSugestoes');
    const lis = listElement.querySelectorAll('li');
    lis.forEach((li, i) => {
      if (i === index) {
        li.classList.add('selected');
        li.scrollIntoView({ block: 'nearest' });
      } else {
        li.classList.remove('selected');
      }
    });
  }
  
  /**
   * Renderiza a secção de dados do utilizador.
   * @param {object} userData - Os dados do utilizador a serem renderizados.
   * @param {string|null} photoHTML - O HTML para a foto do utilizador.
   */
  export function renderUserCard(userData, photoHTML) {
    const cardUsuario = document.getElementById('cardUsuario');
    const userDetailsHTML = renderObjectAsTree(userData);
    cardUsuario.innerHTML = `<div class="card-usuario" style="padding:0;overflow-x:auto;">${
      photoHTML || ''
    }${userDetailsHTML}</div>`;
  
    // Adiciona listeners para expandir/recolher a árvore de detalhes
    cardUsuario.querySelectorAll('.tree-toggle').forEach((span) => {
      span.addEventListener('click', function () {
        const target = cardUsuario.querySelector('#' + span.dataset.target);
        if (target && target.style.display === 'none') {
          target.style.display = 'block';
          span.textContent = '▼';
        } else if (target) {
          target.style.display = 'none';
          span.textContent = '▶';
        }
      });
    });
  }
  
  /**
   * Converte um objeto em uma lista HTML aninhada e expansível (árvore).
   * @param {object} obj - O objeto a ser renderizado.
   * @param {string} [prefixo=''] - Um prefixo para garantir IDs únicos para elementos aninhados.
   * @returns {string} O HTML da lista.
   */
  function renderObjectAsTree(obj, prefixo = '') {
    let html = '<ul style="list-style:none;padding-left:16px;">';
    for (const chave in obj) {
      const valor = obj[chave];
      if (typeof valor === 'object' && valor !== null) {
        const id = 'tree_' + prefixo.replace(/\./g, '_') + chave;
        html += `<li><span class="tree-toggle" data-target="${id}" style="cursor:pointer;color:#0078d7;">▶</span> <strong>${chave}</strong>: <span style="color:#888;">{...}</span><div id="${id}" style="display:none;">${renderObjectAsTree(
          valor,
          prefixo + chave + '.'
        )}</div></li>`;
      } else {
        html += `<li><strong>${chave}</strong>: <span style="color:#222;">${valor}</span></li>`;
      }
    }
    html += '</ul>';
    return html;
  }
  
  /**
   * Exibe ou esconde um spinner de carregamento no cabeçalho de uma secção.
   * @param {string} sessionClass - A classe CSS da secção (ex: 'sessao-compromissos').
   * @param {boolean} isActive - True para mostrar o spinner, false para esconder.
   */
  export function setSessionSpinner(sessionClass, isActive) {
    const header = document.querySelector(`.${sessionClass} .accordion`);
    if (!header) return;
  
    let spinner = header.querySelector('.spinner-sessao');
    if (isActive) {
      if (!spinner) {
        spinner = document.createElement('span');
        spinner.className = 'spinner-sessao';
        spinner.innerHTML = '<span class="lds-dual-ring"></span>';
        header.appendChild(spinner);
      }
    } else {
      if (spinner) spinner.remove();
    }
  }
  
  /**
   * Renderiza uma tabela paginada genérica.
   * @param {object} config
   * @param {string} config.containerId - ID do elemento que conterá a tabela.
   * @param {string} config.title - Título da secção.
   * @param {Array<object>} config.data - Os dados a serem exibidos.
   * @param {Array<{key: string, label: string}>} config.columns - As colunas da tabela.
   * @param {object} config.pagination - Informações de paginação.
   * @param {number} config.pagination.currentPage - A página atual.
   * @param {number} config.pagination.totalPages - O total de páginas.
   * @param {function(number): void} config.onPageChange - Callback a ser chamado quando a página muda.
   */
  export function renderPaginatedTable({ containerId, title, data, columns, pagination, onPageChange }) {
      // Esta função será implementada na Fase 2 para generalizar a criação de tabelas.
      // Por enquanto, mantemos as funções de renderização específicas abaixo.
  }
  
  // NOTA: As funções de renderização específicas (compromissos, lista de espera, etc.)
  // serão mantidas em `handlers.js` por enquanto, pois estão fortemente acopladas
  // à lógica de manipulação de dados. Elas serão movidas para cá na Fase 2,
  // quando criarmos o componente de tabela reutilizável.
  