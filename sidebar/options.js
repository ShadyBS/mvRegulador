/**
 * Lógica para a página de opções.
 */

// Estado local da página de opções
let savedTags = [];
let currentTagCodes = new Set();

// --- Funções de Configurações Gerais ---

function saveGeneralSettings(e) {
  e.preventDefault();
  const itemsPerPage = document.getElementById('itemsPerPage').value;

  chrome.storage.sync.get({ settings: {} }, (data) => {
    const prontuarioPeriodoPadrao = document.getElementById('prontuarioPeriodoPadrao')?.value || 'last_year';
    const newSettings = {
      ...data.settings,
      itemsPerPage: parseInt(itemsPerPage, 10) || 15,
      prontuarioPeriodoPadrao: prontuarioPeriodoPadrao
    };
    chrome.storage.sync.set({ settings: newSettings }, () => showStatus('Configurações gerais guardadas!'));
  });
}

function restoreGeneralSettings() {
  chrome.storage.sync.get({ settings: { itemsPerPage: 15, prontuarioPeriodoPadrao: 'last_year' } }, (data) => {
    document.getElementById('itemsPerPage').value = data.settings.itemsPerPage;
    const prontuarioPeriodoEl = document.getElementById('prontuarioPeriodoPadrao');
    if (prontuarioPeriodoEl) {
        prontuarioPeriodoEl.value = data.settings.prontuarioPeriodoPadrao;
    }
  });
}

// --- Funções do Construtor de Tags ---

/**
 * Função debounce para evitar chamadas excessivas à API.
 */
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Procura códigos CID-10 e CIAP-2 na API oficial do Ministério da Saúde.
 * @param {string} query - O termo a ser pesquisado.
 */
async function searchClinicalCodes(query) {
  const resultsContainer = document.getElementById('code-search-results');
  if (query.length < 3) {
    resultsContainer.innerHTML = '';
    return;
  }
  resultsContainer.innerHTML = '<div class="search-result-item"><span>A pesquisar...</span></div>';
  
  try {
    const url = 'https://simplificador.terminologia.saude.gov.br/api/search';
    const body = {
      "display": 1,
      "text": query,
      "semantic_tags": ["procedure", "disorder", "finding"], // Tags para abranger mais resultados
      "count": 10 // Limita a 10 resultados
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Serviço de busca indisponível (status: ${response.status})`);
    }

    const data = await response.json();
    
    resultsContainer.innerHTML = '';
    if (data.matches && data.matches.length > 0) {
      data.matches.forEach(item => {
        // A API retorna o código dentro de 'term' após os dois pontos
        const codeMatch = item.term.match(/(CID-10|CIAP2)\s-\s(.+)/);
        const code = codeMatch ? item.code : "N/A";
        const description = item.term;
        
        if (code !== "N/A") {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result-item';
            resultDiv.innerHTML = `
              <span><b>${code}</b> - ${description}</span>
              <button type="button" class="add-code-btn" data-code="${code}">Adicionar</button>
            `;
            resultsContainer.appendChild(resultDiv);
        }
      });
      if (resultsContainer.children.length === 0) {
         resultsContainer.innerHTML = '<div class="search-result-item"><span>Nenhum código CID/CIAP encontrado.</span></div>';
      }
    } else {
      resultsContainer.innerHTML = '<div class="search-result-item"><span>Nenhum resultado encontrado.</span></div>';
    }
  } catch (error) {
    resultsContainer.innerHTML = `<div class="search-result-item" style="color: #b91c1c;">Erro ao pesquisar: ${error.message}</div>`;
    console.error("Erro na busca de códigos:", error);
  }
}

const debouncedSearch = debounce(searchClinicalCodes, 500);

/**
 * Adiciona um código à lista de códigos associados da tag atual.
 */
function addCodeToCurrentTag(code) {
  currentTagCodes.add(code);
  renderCurrentTagCodes();
}

/**
 * Remove um código da lista de códigos associados.
 */
function removeCodeFromCurrentTag(code) {
  currentTagCodes.delete(code);
  renderCurrentTagCodes();
}

/**
 * Renderiza os "crachás" (pills) para os códigos da tag atual.
 */
function renderCurrentTagCodes() {
  const container = document.getElementById('associated-codes');
  container.innerHTML = '';
  currentTagCodes.forEach(code => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `
      <span>${code}</span>
      <button class="remove-pill" data-code="${code}" title="Remover código">&times;</button>
    `;
    container.appendChild(pill);
  });
}

/**
 * Limpa o formulário do construtor de tags.
 */
function clearTagBuilder() {
  document.getElementById('tagName').value = '';
  document.getElementById('tagCodeSearch').value = '';
  document.getElementById('code-search-results').innerHTML = '';
  currentTagCodes.clear();
  renderCurrentTagCodes();
}

/**
 * Guarda uma nova tag ou atualiza uma existente.
 */
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
    codes: Array.from(currentTagCodes)
  };

  const tagIndex = savedTags.findIndex(t => t.tagName.toLowerCase() === tagName.toLowerCase());
  
  if (tagIndex > -1) {
    // Atualiza tag existente
    savedTags[tagIndex] = newTag;
  } else {
    // Adiciona nova tag
    savedTags.push(newTag);
  }

  chrome.storage.sync.set({ clinicalTags: savedTags }, () => {
    showStatus(`Tag "${tagName}" guardada com sucesso!`);
    renderSavedTags();
    clearTagBuilder();
  });
}

/**
 * Remove uma tag da lista de tags salvas.
 */
function deleteTag(tagName) {
  if (confirm(`Tem a certeza que quer remover a tag "${tagName}"?`)) {
    savedTags = savedTags.filter(t => t.tagName !== tagName);
    chrome.storage.sync.set({ clinicalTags: savedTags }, () => {
      showStatus(`Tag "${tagName}" removida.`, 'info');
      renderSavedTags();
    });
  }
}

/**
 * Carrega uma tag existente para edição no construtor.
 */
function editTag(tagName) {
    const tag = savedTags.find(t => t.tagName === tagName);
    if (tag) {
        document.getElementById('tagName').value = tag.tagName;
        currentTagCodes = new Set(tag.codes);
        renderCurrentTagCodes();
        document.getElementById('tagName').focus();
    }
}

/**
 * Renderiza a lista de tags já guardadas.
 */
function renderSavedTags() {
  const container = document.getElementById('tag-list');
  container.innerHTML = '';
  if (savedTags.length === 0) {
    container.innerHTML = '<p>Nenhuma tag configurada.</p>';
    return;
  }
  savedTags.forEach(tag => {
    const item = document.createElement('div');
    item.className = 'tag-item';
    item.innerHTML = `
      <div>
        <div class="tag-name">${tag.tagName}</div>
        <div class="pills-container tag-codes">
          ${tag.codes.map(code => `<div class="pill"><span>${code}</span></div>`).join('')}
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

/**
 * Carrega todas as configurações e tags guardadas.
 */
function restoreAllOptions() {
  restoreGeneralSettings();
  chrome.storage.sync.get({ clinicalTags: [] }, (data) => {
    savedTags = data.clinicalTags;
    renderSavedTags();
  });
}

function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#d32f2f' : '#278B77';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
}


// --- Gestores de Eventos ---

document.addEventListener('DOMContentLoaded', restoreAllOptions);
document.getElementById('settings-form').addEventListener('submit', saveGeneralSettings);
document.getElementById('tagCodeSearch').addEventListener('input', (e) => debouncedSearch(e.target.value));
document.getElementById('addTagBtn').addEventListener('click', saveTag);

document.getElementById('code-search-results').addEventListener('click', (e) => {
  if (e.target.classList.contains('add-code-btn')) {
    addCodeToCurrentTag(e.target.dataset.code);
  }
});

document.getElementById('associated-codes').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-pill')) {
    removeCodeFromCurrentTag(e.target.dataset.code);
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
