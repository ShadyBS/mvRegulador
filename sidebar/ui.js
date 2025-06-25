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
 * @private
 * @param {object} obj - O objeto a ser renderizado.
 * @param {string} [prefixo=''] - Um prefixo para garantir IDs únicos.
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
      const escapedValue = String(valor).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<li><strong>${chave}</strong>: <span style="color:#222;">${escapedValue}</span></li>`;
    }
  }
  html += '</ul>';
  return html;
}

/**
 * Exibe ou esconde um spinner de carregamento no cabeçalho de uma secção.
 * @param {string} sessionClass - A classe CSS da secção.
 * @param {boolean} isActive - True para mostrar, false para esconder.
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
 * Exibe uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'info' | 'success' | 'error'} [type='info'] - O tipo de notificação.
 * @param {number} [duration=3000] - A duração em milissegundos.
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Força o reflow para a transição funcionar
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}


/**
 * Renderiza um skeleton de tabela para indicar o carregamento.
 * @param {HTMLElement} container - O elemento onde o skeleton será renderizado.
 * @param {number} rows - O número de linhas do skeleton.
 * @param {number} cols - O número de colunas.
 */
export function renderSkeleton(container, rows = 5, cols = 4) {
    let skeletonHTML = `<table class="tabela-padrao skeleton-table"><tbody>`;
    for (let i = 0; i < rows; i++) {
        skeletonHTML += '<tr>';
        for (let j = 0; j < cols; j++) {
            skeletonHTML += '<td><div class="skeleton skeleton-text"></div></td>';
        }
        skeletonHTML += '</tr>';
    }
    skeletonHTML += '</tbody></table>';
    container.innerHTML = skeletonHTML;
}


/**
 * Função genérica para criar uma secção com título, filtros (opcional) e uma tabela paginada.
 * @param {object} config
 * @param {string} config.containerId - ID do elemento container do painel.
 * @param {string} config.title - Título da secção.
 * @param {object} config.apiCall - A função da API a ser chamada para obter os dados.
 * @param {object} config.apiParams - Os parâmetros para a chamada da API.
 * @param {Array<{key: string, label: string}>} config.columns - Definições das colunas da tabela.
 * @param {function(object): string} [config.rowFormatter] - Função opcional para formatar uma linha de dados em HTML.
 * @param {Array<object>} [config.filters] - Definições para os controlos de filtro.
 */
export async function createSectionWithPaginatedTable(config) {
    const { containerId, title, apiCall, apiParams, columns, rowFormatter, filters } = config;
    const container = document.getElementById(containerId);
    if (!container) return;

    let filterFormHTML = '';
    if (filters) {
        filterFormHTML += `<form id="form-${containerId}" class="filter-form">`;
        filters.forEach(filter => {
            if (filter.type === 'select') {
                filterFormHTML += `<select name="${filter.name}">`;
                filter.options.forEach(opt => {
                    filterFormHTML += `<option value="${opt.value}">${opt.label}</option>`;
                });
                filterFormHTML += `</select>`;
            }
        });
        filterFormHTML += `<button type="submit">Filtrar</button></form>`;
    }

    const tableContainer = document.createElement('div');
    container.innerHTML = `<div class="compromissos-titulo">${title}</div>${filterFormHTML}`;
    container.appendChild(tableContainer);

    const form = container.querySelector('form');

    const fetchDataAndRender = async (page = 1, extraApiParams = {}) => {
        renderSkeleton(tableContainer, 5, columns.length);
        try {
            const data = await apiCall({ ...apiParams, page, ...extraApiParams });
            const totalPaginas = data.total || 1;
            
            let paginacaoHTML = '';
            if (totalPaginas > 1) {
                paginacaoHTML = `
                <div class='paginacao-lista-espera paginacao-topo'>
                    <button class='btn-paginacao' ${page === 1 ? 'disabled' : ''} data-page='${page - 1}'>⏮️</button>
                    <span class='paginacao-info'>Página <b>${page}</b> de <b>${totalPaginas}</b></span>
                    <button class='btn-paginacao' ${page === totalPaginas ? 'disabled' : ''} data-page='${page + 1}'>⏭️</button>
                </div>`;
            }

            let tabelaHTML = `<table class="tabela-padrao"><thead><tr>`;
            columns.forEach(col => tabelaHTML += `<th>${col.label}</th>`);
            tabelaHTML += `</tr></thead><tbody>`;

            if (data.rows && data.rows.length > 0) {
                data.rows.forEach(item => {
                    if (rowFormatter) {
                        tabelaHTML += rowFormatter(item);
                    } else {
                        tabelaHTML += '<tr>';
                        columns.forEach(col => tabelaHTML += `<td>${item[col.key] || '-'}</td>`);
                        tabelaHTML += '</tr>';
                    }
                });
            } else {
                tabelaHTML += `<tr><td colspan="${columns.length}" style="text-align:center;">Nenhum registo encontrado.</td></tr>`;
            }
            tabelaHTML += '</tbody></table>';
            
            tableContainer.innerHTML = paginacaoHTML + tabelaHTML;

            tableContainer.querySelectorAll('.btn-paginacao').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    fetchDataAndRender(parseInt(btn.dataset.page), extraApiParams);
                });
            });
            // Adiciona listeners para quaisquer botões dentro das linhas da tabela
            if (config.onRowButtonClick) {
                tableContainer.querySelectorAll('[data-action]').forEach(btn => {
                    btn.addEventListener('click', (e) => config.onRowButtonClick(e, btn.dataset));
                })
            }

        } catch (e) {
            tableContainer.innerHTML = `<div style='color:#c00;font-size:13px;'>Erro ao buscar dados: ${e.message}</div>`;
        }
    };
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const filterParams = Object.fromEntries(formData.entries());
            fetchDataAndRender(1, { filtros: filterParams });
        });
    }

    fetchDataAndRender(1);
}