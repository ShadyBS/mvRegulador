/**
 * Lógica para a página de opções.
 */

// --- Estado local da página de opções ---
let savedTags = [];
// Usamos um Map para guardar os códigos da tag em edição.
// A chave é o código (ex: "I10"), o valor é o objeto { code, display }.
// Isto previne a adição de códigos duplicados de forma eficiente.
let currentTagCodes = new Map();
// Guarda a lista completa de terminologias para a migração.
let allTerminologyCodes = [];

// --- Funções de Configurações Gerais ---

function saveGeneralSettings(e) {
  e.preventDefault();
  const itemsPerPage = document.getElementById('itemsPerPage').value;
  const prontuarioPeriodoPadrao = document.getElementById(
    'prontuarioPeriodoPadrao'
  ).value;

  chrome.storage.sync.get({ settings: {} }, (data) => {
    const newSettings = {
      ...data.settings,
      itemsPerPage: parseInt(itemsPerPage, 10) || 15,
      prontuarioPeriodoPadrao: prontuarioPeriodoPadrao || 'last_year',
    };
    chrome.storage.sync.set({ settings: newSettings }, () =>
      showStatus('Configurações gerais guardadas!')
    );
  });
}

function restoreGeneralSettings() {
  chrome.storage.sync.get(
    { settings: { itemsPerPage: 15, prontuarioPeriodoPadrao: 'last_year' } },
    (data) => {
      document.getElementById('itemsPerPage').value = data.settings.itemsPerPage;
      const prontuarioPeriodoEl = document.getElementById(
        'prontuarioPeriodoPadrao'
      );
      if (prontuarioPeriodoEl) {
        prontuarioPeriodoEl.value = data.settings.prontuarioPeriodoPadrao;
      }
    }
  );
}

// --- Funções do Construtor de Tags ---

/**
 * Função debounce para evitar chamadas excessivas.
 */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Procura códigos e renderiza os resultados com checkboxes.
 * @param {string} query - O termo a ser pesquisado.
 */
async function searchClinicalCodes(query) {
  const resultsContainer = document.getElementById('code-search-results');
  const searchActions = document.getElementById('search-actions');

  if (query.length < 3) {
    clearSearchResults();
    return;
  }
  resultsContainer.innerHTML =
    '<div class="search-result-item-cb"><span>A pesquisar...</span></div>';

  chrome.runtime.sendMessage(
    { type: 'SEARCH_CLINICAL_CODES', query: query },
    (response) => {
      if (chrome.runtime.lastError) {
        resultsContainer.innerHTML = `<div class="search-result-item-cb" style="color: #b91c1c;">Erro: ${chrome.runtime.lastError.message}</div>`;
        searchActions.style.display = 'none';
        return;
      }

      if (response && response.success) {
        resultsContainer.innerHTML = '';
        const allResults = response.data;
        if (allResults.length > 0) {
          allResults.slice(0, 50).forEach((item) => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result-item-cb';
            // O valor do checkbox é o objeto inteiro como string JSON
            const codeData = JSON.stringify({ code: item.code, display: item.display });
            resultDiv.innerHTML = `
              <input type="checkbox" id="code-${item.code}" value='${codeData}'>
              <label for="code-${item.code}" style="display:flex; cursor:pointer; width:100%;">
                <span class="code-text">${item.code}</span>
                <span class="display-text">${item.display}</span>
              </label>
            `;
            resultsContainer.appendChild(resultDiv);
          });
          searchActions.style.display = 'flex';
        } else {
          resultsContainer.innerHTML =
            '<div class="search-result-item-cb"><span>Nenhum resultado encontrado.</span></div>';
            searchActions.style.display = 'none';
        }
      } else {
        const errorMessage = response ? response.error : 'Erro desconhecido.';
        resultsContainer.innerHTML = `<div class="search-result-item-cb" style="color: #b91c1c;">Erro: ${errorMessage}</div>`;
        searchActions.style.display = 'none';
      }
    }
  );
}

const debouncedSearch = debounce(searchClinicalCodes, 300);

/** Limpa a área de resultados da pesquisa. */
function clearSearchResults() {
    document.getElementById('code-search-results').innerHTML = '';
    document.getElementById('search-actions').style.display = 'none';
    document.getElementById('tagCodeSearch').value = '';
}

/**
 * Marca ou desmarca todos os checkboxes dos resultados da pesquisa.
 * @param {boolean} checked - True para marcar todos, false para desmarcar.
 */
function toggleAllCheckboxes(checked) {
    const checkboxes = document.querySelectorAll('#code-search-results input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checked;
    });
}

/** Adiciona os códigos selecionados via checkbox à tag atual. */
function addSelectedCodes() {
    const checkboxes = document.querySelectorAll('#code-search-results input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        showStatus('Nenhum código selecionado.', 'info');
        return;
    }
    checkboxes.forEach(cb => {
        const codeData = JSON.parse(cb.value);
        currentTagCodes.set(codeData.code, codeData);
    });
    renderCurrentTagCodes();
    showStatus(`${checkboxes.length} código(s) adicionado(s).`);
    clearSearchResults();
}

/** Remove um código da lista de códigos associados. */
function removeCodeFromCurrentTag(code) {
  currentTagCodes.delete(code);
  renderCurrentTagCodes();
}

/** Renderiza os "crachás" (pills) para os códigos da tag atual. */
function renderCurrentTagCodes() {
  const container = document.getElementById('associated-codes');
  container.innerHTML = '';
  currentTagCodes.forEach((codeObj) => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.title = codeObj.display; // Descrição completa no hover
    pill.innerHTML = `
      <span class="pill-code">${codeObj.code}</span>
      <span class="pill-display">${codeObj.display}</span>
      <button class="remove-pill" data-code="${codeObj.code}" title="Remover código">&times;</button>
    `;
    container.appendChild(pill);
  });
}

/** Limpa o formulário do construtor de tags. */
function clearTagBuilder() {
  document.getElementById('tagName').value = '';
  clearSearchResults();
  currentTagCodes.clear();
  renderCurrentTagCodes();
}

/** Guarda uma nova tag ou atualiza uma existente. */
function saveTag() {
  const tagName = document.getElementById('tagName').value.trim();
  if (!tagName) {
    showStatus('O nome da tag não pode estar vazio.', 'error');
    return;
  }
  if (currentTagCodes.size === 0) {
    showStatus('Adicione pelo menos um código à tag.', 'error');
    return;
  }

  const newTag = {
    tagName: tagName,
    // Converte os valores do Map para um array de objetos para guardar
    codes: Array.from(currentTagCodes.values()),
  };

  const tagIndex = savedTags.findIndex(
    (t) => t.tagName.toLowerCase() === tagName.toLowerCase()
  );

  if (tagIndex > -1) {
    savedTags[tagIndex] = newTag;
  } else {
    savedTags.push(newTag);
  }

  chrome.storage.sync.set({ clinicalTags: savedTags }, () => {
    showStatus(`Tag "${tagName}" guardada com sucesso!`);
    renderSavedTags();
    clearTagBuilder();
  });
}

/** Remove uma tag da lista de tags salvas. */
function deleteTag(tagName) {
  if (confirm(`Tem a certeza que quer remover a tag "${tagName}"?`)) {
    savedTags = savedTags.filter((t) => t.tagName !== tagName);
    chrome.storage.sync.set({ clinicalTags: savedTags }, () => {
      showStatus(`Tag "${tagName}" removida.`, 'info');
      renderSavedTags();
    });
  }
}

/** Carrega uma tag existente para edição no construtor. */
function editTag(tagName) {
  const tag = savedTags.find((t) => t.tagName === tagName);
  if (tag) {
    document.getElementById('tagName').value = tag.tagName;
    // Converte o array de objetos de volta para um Map para edição
    currentTagCodes.clear();
    tag.codes.forEach(codeObj => currentTagCodes.set(codeObj.code, codeObj));
    renderCurrentTagCodes();
    document.getElementById('tagName').focus();
  }
}

/** Renderiza a lista de tags já guardadas. */
function renderSavedTags() {
  const container = document.getElementById('tag-list');
  container.innerHTML = '';
  if (savedTags.length === 0) {
    container.innerHTML = '<p>Nenhuma tag configurada.</p>';
    return;
  }
  savedTags.forEach((tag) => {
    const item = document.createElement('div');
    item.className = 'tag-item';
    item.innerHTML = `
      <div>
        <div class="tag-name">${tag.tagName}</div>
        <div class="pills-container tag-codes">
          ${(tag.codes || []).map(
            (codeObj) =>
              `<div class="pill" title="${codeObj.display}">
                 <span class="pill-code">${codeObj.code}</span>
                 <span class="pill-display">${codeObj.display}</span>
               </div>`
          ).join('')}
        </div>
      </div>
      <div class="tag-actions">
        <button class="edit-btn" data-tag-name="${tag.tagName}">Editar</button>
        <button class="remove-btn" data-tag-name="${tag.tagName}">Remover</button>
      </div>
    `;
    container.appendChild(item);
  });
}

/** Exibe uma mensagem de status temporária. */
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status-${type}`;
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = '';
  }, 3000);
}

// --- Funções de Migração de Dados ---

/**
 * Verifica se as tags precisam de ser migradas e inicia o processo.
 * @param {Array<Object>} tags - As tags carregadas do storage.
 */
async function checkForMigration(tags) {
    // Se não há tags, ou se estas não têm códigos, ou se o primeiro código já é um objeto, não há nada a fazer.
    if (!tags || tags.length === 0 || !tags[0].codes || tags[0].codes.length === 0 || typeof tags[0].codes[0] === 'object') {
        savedTags = tags || [];
        renderSavedTags();
        return;
    }

    showStatus('A atualizar formato das tags... Por favor, aguarde.', 'info');
    
    // Carrega a base de dados de códigos completa para encontrar as descrições.
    const terminology = await new Promise(resolve => chrome.storage.local.get('clinicalCodes', resolve));
    const allCodes = [...(terminology.clinicalCodes.cid10 || []), ...(terminology.clinicalCodes.ciap2 || [])];
    const codeMap = new Map(allCodes.map(c => [c.code, c.display]));

    const migratedTags = tags.map(tag => {
        const newCodes = tag.codes.map(codeString => ({
            code: codeString,
            display: codeMap.get(codeString) || 'Descrição não encontrada'
        }));
        return { ...tag, codes: newCodes };
    });

    // Guarda as tags migradas de volta no storage.
    chrome.storage.sync.set({ clinicalTags: migratedTags }, () => {
        savedTags = migratedTags;
        renderSavedTags();
        showStatus('Tags atualizadas com sucesso para o novo formato!', 'success');
    });
}

/** Carrega todas as configurações e tags guardadas. */
async function restoreAllOptions() {
  restoreGeneralSettings();
  chrome.storage.sync.get({ clinicalTags: [] }, (data) => {
    // Chama a função de verificação de migração.
    checkForMigration(data.clinicalTags);
  });
}

// --- Gestores de Eventos ---

document.addEventListener('DOMContentLoaded', restoreAllOptions);
document.getElementById('settings-form').addEventListener('submit', saveGeneralSettings);
document.getElementById('tagCodeSearch').addEventListener('input', (e) => debouncedSearch(e.target.value));
document.getElementById('addTagBtn').addEventListener('click', saveTag);
document.getElementById('addSelectedBtn').addEventListener('click', addSelectedCodes);
document.getElementById('clearSearchBtn').addEventListener('click', clearSearchResults);
document.getElementById('selectAllBtn').addEventListener('click', () => toggleAllCheckboxes(true));
document.getElementById('deselectAllBtn').addEventListener('click', () => toggleAllCheckboxes(false));


document.getElementById('associated-codes').addEventListener('click', (e) => {
    // Procura o botão de remover, mesmo que o clique seja no ícone dentro dele.
    const removeButton = e.target.closest('.remove-pill');
    if (removeButton) {
      removeCodeFromCurrentTag(removeButton.dataset.code);
    }
});

document.getElementById('tag-list').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-btn')) {
    deleteTag(e.target.dataset.tagName);
  }
  if (e.target.classList.contains('edit-btn')) {
    editTag(e.target.dataset.tagName);
  }
});
