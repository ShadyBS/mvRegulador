// --- Estado Local da Página de Opções ---
let savedTags = [];
let currentTagItems = new Map(); // Usa um Map para evitar itens duplicados (código ou regra)

// --- Gestores de DOM ---
const DOMElements = {
  settingsForm: document.getElementById('settings-form'),
  tagNameInput: document.getElementById('tagName'),
  tagTypeRadios: document.querySelectorAll('input[name="tagType"]'),
  codeBuilder: document.getElementById('code-builder-container'),
  keywordBuilder: document.getElementById('keyword-builder-container'),
  tagCodeSearch: document.getElementById('tagCodeSearch'),
  searchResults: document.getElementById('code-search-results'),
  searchActions: document.getElementById('search-actions'),
  addSelectedBtn: document.getElementById('addSelectedBtn'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  deselectAllBtn: document.getElementById('deselectAllBtn'),
  matchLogicRadios: document.querySelectorAll('input[name="matchLogic"]'),
  ruleMatchType: document.getElementById('ruleMatchType'),
  ruleValueInput: document.getElementById('ruleValue'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  regexValidator: document.getElementById('regex-validator'),
  associatedItems: document.getElementById('associated-items'),
  saveTagBtn: document.getElementById('saveTagBtn'),
  tagList: document.getElementById('tag-list'),
  status: document.getElementById('status'),
};

// --- Funções de UI ---

function showStatus(message, type = 'success') {
  DOMElements.status.textContent = message;
  DOMElements.status.className = `status-${type}`;
  setTimeout(() => {
    DOMElements.status.textContent = '';
    DOMElements.status.className = '';
  }, 3000);
}

function updateBuilderUI(type) {
  DOMElements.codeBuilder.style.display = type === 'code' ? 'block' : 'none';
  DOMElements.keywordBuilder.style.display = type === 'keyword' ? 'block' : 'none';
}

function clearSearch() {
    DOMElements.tagCodeSearch.value = '';
    DOMElements.searchResults.innerHTML = '';
    DOMElements.searchActions.style.display = 'none';
}

// --- Funções do Construtor de Tags ---

const debouncedSearch = debounce((query) => {
    if (query.length < 3) {
        DOMElements.searchResults.innerHTML = '';
        DOMElements.searchActions.style.display = 'none';
        return;
    }
    searchClinicalCodes(query);
}, 300);

async function searchClinicalCodes(query) {
  DOMElements.searchResults.innerHTML = '<div class="search-result-item-cb"><span>A pesquisar...</span></div>';
  chrome.runtime.sendMessage({ type: 'SEARCH_CLINICAL_CODES', query }, (response) => {
    DOMElements.searchResults.innerHTML = '';
    if (response && response.success && response.data.length > 0) {
      response.data.slice(0, 50).forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'search-result-item-cb';
        const itemData = JSON.stringify({ code: item.code, display: item.display });
        itemDiv.innerHTML = `
          <input type="checkbox" id="code-${item.code}" value='${itemData}'>
          <label for="code-${item.code}" style="display:flex; cursor:pointer; width:100%;">
            <span class="code-text">${item.code}</span><span class="display-text">${item.display}</span>
          </label>`;
        DOMElements.searchResults.appendChild(itemDiv);
      });
      DOMElements.searchActions.style.display = 'flex';
    } else {
      DOMElements.searchResults.innerHTML = '<div class="search-result-item-cb"><span>Nenhum resultado encontrado.</span></div>';
      DOMElements.searchActions.style.display = 'none';
    }
  });
}

function addSelectedCodes() {
  const checked = DOMElements.searchResults.querySelectorAll('input:checked');
  checked.forEach(cb => {
    const itemData = JSON.parse(cb.value);
    currentTagItems.set(itemData.code, itemData);
  });
  renderCurrentItems('code');
  clearSearch();
}

function addKeywordRule() {
    const matchType = DOMElements.ruleMatchType.value;
    const value = DOMElements.ruleValueInput.value.trim();
    if (!value) {
        showStatus('O valor da regra não pode estar vazio.', 'error');
        return;
    }
    if (matchType === 'regex') {
        try {
            new RegExp(value);
        } catch (e) {
            showStatus('A expressão regular (Regex) é inválida.', 'error');
            return;
        }
    }
    const rule = { matchType, value };
    // Usar o valor e o tipo como chave para evitar duplicados exatos
    currentTagItems.set(`${matchType}-${value}`, rule);
    renderCurrentItems('keyword');
    DOMElements.ruleValueInput.value = '';
    DOMElements.ruleValueInput.classList.remove('regex-valid-border', 'regex-invalid-border');
    DOMElements.regexValidator.textContent = '';
}

function renderCurrentItems(type) {
  DOMElements.associatedItems.innerHTML = '';
  currentTagItems.forEach((item, key) => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    if (type === 'code') {
      pill.title = item.display;
      pill.innerHTML = `<span class="pill-code">${item.code}</span><span class="pill-display">${item.display}</span>`;
    } else { // keyword
      pill.title = `${item.matchType}: ${item.value}`;
      pill.innerHTML = `<span class="pill-rule">${item.matchType.replace('_', ' ')}</span><span class="pill-value">${item.value}</span>`;
    }
    pill.innerHTML += `<button class="remove-pill" data-key="${key}" title="Remover">&times;</button>`;
    DOMElements.associatedItems.appendChild(pill);
  });
}

function saveTag() {
  const tagName = DOMElements.tagNameInput.value.trim();
  if (!tagName) {
    showStatus('O nome da tag não pode estar vazio.', 'error');
    return;
  }
  if (currentTagItems.size === 0) {
    showStatus('Adicione pelo menos um item (código ou regra) à tag.', 'error');
    return;
  }
  
  const type = document.querySelector('input[name="tagType"]:checked').value;
  const newTag = {
    tagName,
    type,
    items: Array.from(currentTagItems.values()),
    matchLogic: type === 'keyword' ? document.querySelector('input[name="matchLogic"]:checked').value : 'OR',
  };

  const tagIndex = savedTags.findIndex(t => t.tagName.toLowerCase() === tagName.toLowerCase());
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

function renderSavedTags() {
    DOMElements.tagList.innerHTML = '';
    if (savedTags.length === 0) {
        DOMElements.tagList.innerHTML = '<p>Nenhuma tag configurada.</p>';
        return;
    }
    savedTags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'tag-item';
        const type = tag.type || 'code';
        const logic = tag.matchLogic || 'OR';
        item.innerHTML = `
            <div class="tag-header">
                <div>
                    <span class="tag-name">${tag.tagName}</span>
                    <span class="tag-type-indicator ${type}">${type === 'code' ? 'CÓDIGO' : `TEXTO (${logic})`}</span>
                </div>
                <div class="tag-actions">
                    <button class="edit-btn" data-tag-name="${tag.tagName}">Editar</button>
                    <button class="remove-btn" data-tag-name="${tag.tagName}">Remover</button>
                </div>
            </div>
            <div class="pills-container">
            ${(tag.items || tag.codes || []).map(i => {
                if(type === 'code') {
                    return `<div class="pill" title="${i.display}"><span class="pill-code">${i.code}</span><span class="pill-display">${i.display}</span></div>`;
                } else {
                    return `<div class="pill" title="${i.matchType}: ${i.value}"><span class="pill-rule">${i.matchType.replace('_', ' ')}</span><span class="pill-value">${i.value}</span></div>`;
                }
            }).join('')}
            </div>`;
        DOMElements.tagList.appendChild(item);
    });
}

function editTag(tagName) {
    const tag = savedTags.find(t => t.tagName === tagName);
    if (!tag) return;
    
    clearTagBuilder();
    DOMElements.tagNameInput.value = tag.tagName;
    
    const type = tag.type || 'code';
    document.querySelector(`input[name="tagType"][value="${type}"]`).checked = true;
    updateBuilderUI(type);
    
    const items = tag.items || tag.codes || [];
    items.forEach(item => {
        const key = type === 'code' ? item.code : `${item.matchType}-${item.value}`;
        currentTagItems.set(key, item);
    });

    if (type === 'keyword') {
        const logic = tag.matchLogic || 'OR';
        document.querySelector(`input[name="matchLogic"][value="${logic}"]`).checked = true;
    }

    renderCurrentItems(type);
    DOMElements.tagNameInput.focus();
}

function deleteTag(tagName) {
    if (confirm(`Tem a certeza de que quer remover a tag "${tagName}"?`)) {
        savedTags = savedTags.filter(t => t.tagName !== tagName);
        chrome.storage.sync.set({ clinicalTags: savedTags }, () => {
            showStatus(`Tag "${tagName}" removida.`, 'info');
            renderSavedTags();
        });
    }
}

function clearTagBuilder() {
  DOMElements.tagNameInput.value = '';
  currentTagItems.clear();
  clearSearch();
  updateBuilderUI(document.querySelector('input[name="tagType"]:checked').value);
  renderCurrentItems('code'); // Renderiza vazio
  DOMElements.ruleValueInput.value = '';
}

function validateRegex(pattern) {
    try {
        new RegExp(pattern);
        DOMElements.ruleValueInput.classList.add('regex-valid-border');
        DOMElements.ruleValueInput.classList.remove('regex-invalid-border');
        DOMElements.regexValidator.textContent = 'Regex válida.';
        DOMElements.regexValidator.className = 'regex-valid';
    } catch (e) {
        DOMElements.ruleValueInput.classList.add('regex-invalid-border');
        DOMElements.ruleValueInput.classList.remove('regex-valid-border');
        DOMElements.regexValidator.textContent = 'Regex inválida.';
        DOMElements.regexValidator.className = 'regex-invalid';
    }
}

// --- Funções de Inicialização e Migração ---

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

async function runMigrationIfNeeded(tags) {
    let needsMigration = false;
    tags.forEach(tag => {
        if (!tag.type || !tag.items) {
            needsMigration = true;
        }
    });

    if (!needsMigration) return tags;

    showStatus('A atualizar formato antigo das tags...', 'info');
    const terminology = await new Promise(resolve => chrome.storage.local.get('clinicalCodes', resolve));
    const allCodes = [...(terminology.clinicalCodes.cid10 || []), ...(terminology.clinicalCodes.ciap2 || [])];
    const codeMap = new Map(allCodes.map(c => [c.code, c.display]));

    const migratedTags = tags.map(tag => {
        if (tag.type && tag.items) return tag; // Já está no formato novo
        const items = (tag.codes || []).map(codeString => ({
            code: codeString,
            display: codeMap.get(codeString) || 'Não encontrado',
        }));
        return { tagName: tag.tagName, type: 'code', items, matchLogic: 'OR' };
    });

    await new Promise(resolve => chrome.storage.sync.set({ clinicalTags: migratedTags }, resolve));
    showStatus('Tags atualizadas com sucesso!', 'success');
    return migratedTags;
}

async function initialize() {
  // Configurações Gerais
  chrome.storage.sync.get({ settings: { itemsPerPage: 15, prontuarioPeriodoPadrao: 'last_year' } }, (data) => {
      document.getElementById('itemsPerPage').value = data.settings.itemsPerPage;
      document.getElementById('prontuarioPeriodoPadrao').value = data.settings.prontuarioPeriodoPadrao;
  });

  // Carrega as tags e corre a migração se necessário
  let { clinicalTags = [] } = await new Promise(resolve => chrome.storage.sync.get('clinicalTags', resolve));
  savedTags = await runMigrationIfNeeded(clinicalTags);
  renderSavedTags();
  
  // Event Listeners
  DOMElements.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const settings = {
          itemsPerPage: parseInt(document.getElementById('itemsPerPage').value, 10),
          prontuarioPeriodoPadrao: document.getElementById('prontuarioPeriodoPadrao').value
      };
      chrome.storage.sync.set({ settings }, () => showStatus('Configurações gerais guardadas!'));
  });
  
  DOMElements.tagTypeRadios.forEach(radio => radio.addEventListener('change', (e) => updateBuilderUI(e.target.value)));
  DOMElements.tagCodeSearch.addEventListener('input', (e) => debouncedSearch(e.target.value));
  DOMElements.selectAllBtn.addEventListener('click', () => DOMElements.searchResults.querySelectorAll('input').forEach(cb => cb.checked = true));
  DOMElements.deselectAllBtn.addEventListener('click', () => DOMElements.searchResults.querySelectorAll('input').forEach(cb => cb.checked = false));
  DOMElements.addSelectedBtn.addEventListener('click', addSelectedCodes);
  DOMElements.ruleValueInput.addEventListener('input', (e) => {
      if(DOMElements.ruleMatchType.value === 'regex') validateRegex(e.target.value);
  });
  DOMElements.ruleMatchType.addEventListener('change', () => {
      DOMElements.ruleValueInput.classList.remove('regex-valid-border', 'regex-invalid-border');
      DOMElements.regexValidator.textContent = '';
  });
  DOMElements.addRuleBtn.addEventListener('click', addKeywordRule);
  DOMElements.saveTagBtn.addEventListener('click', saveTag);
  DOMElements.associatedItems.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.remove-pill');
      if (removeBtn) {
          currentTagItems.delete(removeBtn.dataset.key);
          renderCurrentItems(document.querySelector('input[name="tagType"]:checked').value);
      }
  });
  DOMElements.tagList.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-btn')) editTag(e.target.dataset.tagName);
      if (e.target.classList.contains('remove-btn')) deleteTag(e.target.dataset.tagName);
  });
}

document.addEventListener('DOMContentLoaded', initialize);
