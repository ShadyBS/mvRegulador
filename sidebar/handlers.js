import * as api from './api.js';
import * as ui from './ui.js';
import * as parser from './parser.js';
import { state, setCurrentUser, setSuggestions, setSelectedSuggestionIndex, setSearchHistory, setSettings } from './state.js';
import { logError } from './error-handler.js';

// Elementos do DOM
const inputBusca = document.getElementById('inputBusca');
const listaSugestoes = document.getElementById('listaSugestoes');
const resultadoEl = document.getElementById('resultado');

export async function handleSearchInput(event) {
  const termo = event.target.value.trim();
  if (event.key === 'Enter') {
    if (termo.length < 3) {
      ui.showToast('Digite pelo menos 3 caracteres.', 'info');
      return;
    }
    resultadoEl.textContent = '🔎 Buscando...';
    resultadoEl.style.display = 'block';
    ui.setSessionSpinner('sessao-usuario', true);
    try {
      const data = await api.fetchBuscarUsuarioGenerico({ searchString: termo });
      setSuggestions(data || []);
      ui.renderSuggestions(state.suggestions);
      resultadoEl.style.display = 'none';
    } catch (error) {
      logError(error, 'handleSearchInput');
      ui.showToast(`Erro: ${error.message}`, 'error');
    } finally {
      ui.setSessionSpinner('sessao-usuario', false);
    }
  }
}

export function handleSuggestionKeydown(event) {
  if (listaSugestoes.style.display !== 'block') return;

  const { suggestions, selectedSuggestionIndex } = state;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (selectedSuggestionIndex < suggestions.length - 1) {
        setSelectedSuggestionIndex(selectedSuggestionIndex + 1);
        ui.updateSuggestionSelection(state.selectedSuggestionIndex);
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (selectedSuggestionIndex > 0) {
        setSelectedSuggestionIndex(selectedSuggestionIndex - 1);
        ui.updateSuggestionSelection(state.selectedSuggestionIndex);
      }
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedSuggestionIndex >= 0) {
        handleSelectSuggestion(selectedSuggestionIndex);
      }
      break;
    case 'Escape':
      listaSugestoes.style.display = 'none';
      break;
  }
}

export async function handleSelectSuggestion(index) {
  if (index < 0 || index >= state.suggestions.length) return;

  setSelectedSuggestionIndex(index);
  listaSugestoes.style.display = 'none';
  
  const sugestao = state.suggestions[index];
  const idp = sugestao[0];
  const ids = sugestao[1];

  clearAllSections();

  ui.setSessionSpinner('sessao-usuario', true);
  try {
    const data = await api.fetchVisualizaUsuario({ idp, ids });
    
    if (data && data.usuarioServico) {
      const user = data.usuarioServico;
      setCurrentUser(user);
      manageSearchHistory(user);

      const fotoPath = user.entidadeFisica?.foto;
      let fotoHTML = null;
      if (fotoPath) {
        const fotoSrc = fotoPath.startsWith('/') ? `http://saude.farroupilha.rs.gov.br${fotoPath}` : `http://saude.farroupilha.rs.gov.br/sigss/${fotoPath}`;
        fotoHTML = `<div class="foto-usuario-container"><img src="${fotoSrc}" alt="Foto do usuário" class="foto-usuario" onerror="this.style.display='none'" /></div>`;
      }
      ui.renderUserCard(user, fotoHTML);
      
      renderAllSections(user);
    } else {
      ui.showToast('Detalhes do utilizador não encontrados.', 'error');
    }
  } catch (error) {
    logError(error, 'handleSelectSuggestion');
    ui.showToast(`Erro ao buscar detalhes: ${error.message}`, 'error');
  } finally {
    ui.setSessionSpinner('sessao-usuario', false);
  }
}

function clearAllSections() {
    document.getElementById('cardUsuario').innerHTML = '';
    document.getElementById('dashboard-container').innerHTML = '';
    document.getElementById('patient-tags-container').innerHTML = '';
    document.getElementById('compromissosTabela').innerHTML = '';
    document.getElementById('listaEsperaUsuario').innerHTML = '';
    document.getElementById('regulacaoPanel').innerHTML = '';
    document.getElementById('agendamentosExamePanel').innerHTML = '';
    const comparacaoSessao = document.getElementById("sessao-comparacao-cadsus");
    if (comparacaoSessao) comparacaoSessao.remove();
}

export async function loadSettings() {
    chrome.storage.sync.get({ settings: { itemsPerPage: 15, prontuarioPeriodoPadrao: 'last_year' } }, (data) => {
        setSettings(data.settings);
    });
}

export async function loadAndRenderHistory() {
    chrome.storage.local.get({ searchHistory: [] }, (data) => {
        setSearchHistory(data.searchHistory);
        renderHistory();
    });
}

function manageSearchHistory(user) {
    let history = state.searchHistory;
    const userIdentifier = api.getUsuarioFullPK(user);
    
    history = history.filter(item => item.id !== userIdentifier);

    history.unshift({
        id: userIdentifier,
        name: user.entidadeFisica.entidade.entiNome,
        idp: user.isenPK.idp,
        ids: user.isenPK.ids,
    });

    if (history.length > 10) {
        history.pop();
    }

    setSearchHistory(history);
    chrome.storage.local.set({ searchHistory: history });
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('history-container');
    container.innerHTML = '<h3>Histórico Recente:</h3>';
    const list = document.createElement('div');
    list.className = 'history-list';

    if (state.searchHistory.length === 0) {
        list.innerHTML = '<span style="font-size:12px; color:#555;">Nenhum histórico.</span>';
    } else {
        state.searchHistory.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'history-item';
            btn.textContent = item.name.split(' ')[0];
            btn.title = item.name;
            btn.dataset.idp = item.idp;
            btn.dataset.ids = item.ids;
            btn.addEventListener('click', handleHistoryClick);
            list.appendChild(btn);
        });
    }
    container.appendChild(list);
}

async function handleHistoryClick(event) {
    const { idp, ids } = event.target.dataset;
    clearAllSections();
    const fakeSuggestion = [idp, ids, '', '', '', event.target.title, '', ''];
    setSuggestions([fakeSuggestion]);
    handleSelectSuggestion(0);
}

async function renderDashboard(user) {
    const container = document.getElementById('dashboard-container');
    ui.renderSkeleton(container, 1, 4); 

    try {
        const userId = api.getUsuarioFullPK(user);
        const [listaEsperaData, regulacoesData, gestanteData] = await Promise.all([
            api.fetchListaEsperaPorIsenPK({ isenPK: userId, rows: 1 }),
            api.fetchRegulacaoRegulador({ usuario: user, rows: 1 }),
            user.entidadeFisica.entfSexo === 'Feminino' ? api.fetchStatusGestante({ isenFullPK: userId }) : Promise.resolve(null),
        ]);

        const idadeCalculada = calcularIdade(user.entidadeFisica?.entfDtNasc);
        const statusGestacional = analisarStatusGestacional(gestanteData);

        const stats = {
            listaEspera: listaEsperaData.records || 0,
            regulacoes: regulacoesData.records || 0,
            idade: idadeCalculada,
            gestacional: statusGestacional,
        };

        const hasCryptoKey = !!user.isenFullPKCrypto;

        container.innerHTML = `
            <div class="dashboard-action-card">
                <select id="prontuario-periodo" title="Selecione o período para o prontuário">
                    <option value="last_year">Último ano</option>
                    <option value="last_6_months">Últimos 6 meses</option>
                    <option value="all_time">Todo o período</option>
                </select>
                <button id="open-prontuario-btn" ${!hasCryptoKey ? 'disabled' : ''} title="${!hasCryptoKey ? 'ID de segurança do paciente não encontrado.' : 'Abrir prontuário completo'}">
                    Abrir Prontuário
                </button>
            </div>
            <div class="dashboard-card ${stats.gestacional.classe}">
                <div class="value">${stats.gestacional.icone} ${stats.gestacional.valor}</div>
                <div class="label">${stats.gestacional.rotulo}</div>
            </div>
            <div class="dashboard-card ${stats.listaEspera > 0 ? 'alert' : ''}">
                <div class="value">${stats.listaEspera}</div>
                <div class="label">Lista de Espera</div>
            </div>
            <div class="dashboard-card ${stats.regulacoes > 0 ? 'alert' : ''}">
                <div class="value">${stats.regulacoes}</div>
                <div class="label">Regulações Ativas</div>
            </div>
            <div class="dashboard-card">
                <div class="value">${stats.idade}</div>
                <div class="label">Idade</div>
            </div>
        `;

        document.getElementById('prontuario-periodo').value = state.settings.prontuarioPeriodoPadrao;
        if (hasCryptoKey) {
            document.getElementById('open-prontuario-btn').addEventListener('click', handleOpenProntuarioClick);
        }

    } catch (e) {
        logError(e, 'renderDashboard');
        container.innerHTML = `<div style="color: #c00; font-size: 12px; grid-column: 1 / -1;">Erro ao carregar dashboard.</div>`;
    }
}


async function handleOpenProntuarioClick() {
    const prontuarioBtn = document.getElementById('open-prontuario-btn');
    prontuarioBtn.disabled = true;
    prontuarioBtn.textContent = 'A gerar...';
    
    try {
        const user = state.currentUser;
        if (!user || !user.isenFullPKCrypto) {
            throw new Error('ID de segurança do paciente não encontrado.');
        }

        const periodoSelecionado = document.getElementById('prontuario-periodo').value;
        const { dataInicial, dataFinal } = calcularDatas(periodoSelecionado);

        const paramHash = await api.fetchProntuarioHash({
            isenFullPKCrypto: user.isenFullPKCrypto,
            dataInicial,
            dataFinal,
        });

        const url = `http://saude.farroupilha.rs.gov.br/sigss/prontuarioAmbulatorial2.jsp?paramHash=${paramHash}`;
        window.open(url, '_blank');

    } catch (error) {
        logError(error, 'handleOpenProntuarioClick');
        ui.showToast(error.message, 'error');
    } finally {
        prontuarioBtn.disabled = false;
        prontuarioBtn.textContent = 'Abrir Prontuário';
    }
}

function calcularDatas(periodo) {
    const hoje = new Date();
    const dataFinal = hoje.toLocaleDateString('pt-BR');
    let dataInicial;

    if (periodo === 'last_6_months') {
        const dataPassada = new Date();
        dataPassada.setMonth(hoje.getMonth() - 6);
        dataInicial = dataPassada.toLocaleDateString('pt-BR');
    } else if (periodo === 'all_time') {
        dataInicial = '01/01/1900';
    } else {
        const dataPassada = new Date();
        dataPassada.setFullYear(hoje.getFullYear() - 1);
        dataInicial = dataPassada.toLocaleDateString('pt-BR');
    }
    return { dataInicial, dataFinal };
}

function renderAllSections(user) {
    renderDashboard(user);
    applyPatientTags(user);
    renderComparacaoCadsus(user);
    renderCompromissos(user);
    renderListaEspera(user);
    renderRegulacoes(user);
    renderAgendamentosExame(user);
}

function checkKeywordRule(rule, prontuarioTextLower) {
  const value = rule.value.toLowerCase();
  switch (rule.matchType) {
    case 'contains':
      return prontuarioTextLower.includes(value);
    case 'not_contains':
      return !prontuarioTextLower.includes(value);
    case 'regex':
      try {
        return new RegExp(rule.value, 'i').test(prontuarioTextLower);
      } catch (e) {
        return false;
      }
    default:
      return false;
  }
}

function checkTagMatch(tag, codesInProntuario, prontuarioTextLower) {
    const type = tag.type || 'code';
    const items = tag.items || tag.codes || [];

    if (items.length === 0) return false;

    if (type === 'code') {
        return items.some(item => codesInProntuario.has(item.code));
    }
    
    if (type === 'keyword') {
        const logic = tag.matchLogic || 'OR';
        if (logic === 'AND') {
            return items.every(rule => checkKeywordRule(rule, prontuarioTextLower));
        } else { // OR
            return items.some(rule => checkKeywordRule(rule, prontuarioTextLower));
        }
    }
    
    return false;
}

async function applyPatientTags(user) {
    const container = document.getElementById('patient-tags-container');
    container.innerHTML = '<span style="font-size:12px; color:#555;">A analisar prontuário para tags...</span>';
  
    try {
      const { prontuarioPeriodoPadrao } = state.settings;
      const { dataInicial, dataFinal } = calcularDatas(prontuarioPeriodoPadrao);
  
      const prontuarioText = await api.fetchProntuarioText({
        isenFullPKCrypto: user.isenFullPKCrypto,
        dataInicial,
        dataFinal,
      });
      
      const prontuarioTextLower = prontuarioText.toLowerCase();
      const codesInProntuario = parser.extractCodes(prontuarioText);
      
      chrome.storage.sync.get(null, (allStorageData) => {
          const allTags = [];
          for (const key in allStorageData) {
              if (key.startsWith('tag_')) {
                  allTags.push(allStorageData[key]);
              }
          }

          const matchingTags = allTags.filter(tag => 
              checkTagMatch(tag, codesInProntuario, prontuarioTextLower)
          );
          
          ui.renderPatientTags(matchingTags);
      });
  
    } catch (error) {
      logError(error, 'applyPatientTags');
      container.innerHTML = `<span style="font-size:12px; color:#c00;">Erro ao analisar tags.</span>`;
    }
}

async function renderComparacaoCadsus(user) {
    let comparacaoSessao = document.getElementById("sessao-comparacao-cadsus");
    if (!comparacaoSessao) {
        comparacaoSessao = document.createElement("section");
        comparacaoSessao.id = "sessao-comparacao-cadsus";
        comparacaoSessao.className = "sessao-comparacao-cadsus";
        comparacaoSessao.innerHTML = `
            <button class="accordion active" type="button">Comparação com CADSUS</button>
            <div class="panel show" id="comparacaoDiv"></div>
        `;
        document.querySelector('.sessao-usuario').after(comparacaoSessao);
        comparacaoSessao.querySelector('.accordion').addEventListener('click', function() {
            this.classList.toggle('active');
            this.nextElementSibling.classList.toggle('show');
        });
    }
    const comparacaoDiv = document.getElementById("comparacaoDiv");
    const cpf = user?.entidadeFisica?.entfCPF;
    if (cpf) {
        comparacaoDiv.innerHTML = '<div style="padding:10px;">🔎 Comparando com CADSUS...</div>';
        try {
            const htmlComparacao = await api.fetchAndCompareFichaCadsus({ ficha: user, cpf });
            const { html } = api.parseCadsusComparacaoResponse(htmlComparacao);
            comparacaoDiv.innerHTML = html;
        } catch (e) {
            logError(e, 'renderComparacaoCadsus');
            comparacaoDiv.innerHTML = `<div style='color:#c00; padding:10px;'>Erro ao comparar: ${e.message}</div>`;
        }
    } else {
        comparacaoDiv.innerHTML = '<div style="padding:10px;">CPF não disponível para comparação.</div>';
    }
}

function renderCompromissos(user) {
    const hoje = new Date();
    const dataFinal = hoje.toLocaleDateString('pt-BR');
    const dataInicial = new Date(hoje.getFullYear() - 5, hoje.getMonth(), hoje.getDate()).toLocaleDateString('pt-BR');

    ui.createSectionWithPaginatedTable({
        containerId: 'compromissosTabela',
        title: 'Histórico de Compromissos',
        apiCall: api.fetchCompromissosUsuario,
        apiParams: { isenPK: api.getUsuarioFullPK(user), dataInicial, dataFinal, rows: state.settings.itemsPerPage },
        columns: [
            { key: 'data', label: 'Data' }, { key: 'hora', label: 'Hora' }, { key: 'unidade', label: 'Unidade' },
            { key: 'profissional', label: 'Profissional' }, { key: 'procedimento', label: 'Procedimento' }, { key: 'faltou', label: 'Faltou?' }
        ],
        rowFormatter: (item) => {
            const c = item.cell;
            return `<tr>
                <td>${c[2]}</td><td>${c[3]}</td><td>${c[4]}</td>
                <td>${c[5]}</td><td>${c[6]}</td><td>${c[10].replace(/<[^>]+>/g, '')}</td>
            </tr>`;
        }
    });
}

function renderListaEspera(user) {
    ui.createSectionWithPaginatedTable({
        containerId: 'listaEsperaUsuario',
        title: 'Lista de Espera SIGSS',
        apiCall: api.fetchListaEsperaPorIsenPK,
        apiParams: { isenPK: api.getUsuarioFullPK(user), rows: state.settings.itemsPerPage },
        columns: [
            { label: 'Situação' }, { label: 'Tipo' }, { label: 'Gravidade' }, { label: 'Data Entrada' },
            { label: 'Procedimento' }, { label: 'Origem' }, { label: 'Ações' }
        ],
        rowFormatter: (item) => {
            const { procedimento, origem } = extrairProcedimentoOrigem(item.especialidade);
            let btnImprimir = '';
            if (item.tipo === 'EXA') {
                btnImprimir = `<button class='btn-imprimir-exame' title='Imprimir requisição' data-action="print-req" data-idp='${item.cell[0]}' data-ids='${item.cell[1]}'>🖨️</button>`;
            }
            return `<tr>
                <td>${item.situacao}</td><td>${item.tipo}</td><td>${item.gravidade}</td>
                <td>${item.dataEntrada}</td><td>${procedimento}</td><td>${origem}</td>
                <td>${btnImprimir}</td>
            </tr>`;
        },
        onRowButtonClick: async (event, data) => {
            if (data.action === 'print-req') {
                try {
                    await api.fetchImprimirRequisicaoExameNaoLab(data.idp, data.ids);
                } catch (e) {
                    logError(e, 'onRowButtonClick:print-req');
                    ui.showToast(e.message, 'error');
                }
            }
        }
    });
}

function renderRegulacoes(user) {
     ui.createSectionWithPaginatedTable({
        containerId: 'regulacaoPanel',
        title: 'Regulações',
        apiCall: api.fetchRegulacaoRegulador,
        apiParams: { usuario: user, rows: state.settings.itemsPerPage },
        filters: [ {
            type: 'select', name: 'status',
            options: [
                { value: '', label: 'Todos os Status' }, { value: 'AUTORIZADO', label: 'Autorizado' },
                { value: 'PENDENTE', label: 'Pendente' }, { value: 'DEVOLVIDO', label: 'Devolvido' },
                { value: 'NEGADO', label: 'Negado' }, { value: 'CANCELADA', label: 'Cancelado' },
            ]
        } ],
        columns: [
            { label: 'ID' }, { label: 'Tipo' }, { label: 'Prioridade' }, { label: 'Data' }, 
            { label: 'Status' }, { label: 'Procedimento/CID' }, { label: 'Ações' }
        ],
        rowFormatter: (item) => {
            const c = item.cell;
            const status = (c[5] || "").replace(/<[^>]+>/g, "");
            const btnDetalhes = `<button title='Ver detalhes' data-action="details" data-idp='${c[0]}' data-ids='${c[1]}'>🔎</button>`;
            return `<tr>
                <td>${c[0]}</td><td>${c[2]}</td><td>${c[3]}</td><td>${c[4]}</td>
                <td>${status}</td><td>${c[6]}</td><td>${btnDetalhes}</td>
            </tr>`;
        },
        onRowButtonClick: async (event, data) => {
            if (data.action === 'details') {
                try {
                    const detalhes = await api.fetchDetalhesRegulacao(data);
                    ui.showToast(`Detalhes para Regulação ID: ${data.idp} carregados.`, 'info');
                    console.log(detalhes);
                } catch (e) {
                    logError(e, 'onRowButtonClick:details');
                    ui.showToast(e.message, 'error');
                }
            }
        }
    });
}

function renderAgendamentosExame(user) {
    ui.createSectionWithPaginatedTable({
        containerId: 'agendamentosExamePanel',
        title: 'Agendamentos de Exame',
        apiCall: api.fetchAgendamentosExame,
        apiParams: { 
            searchField: 'isen.isenCod', 
            searchString: user.isenCod, 
            rows: state.settings.itemsPerPage 
        },
        columns: [
            { label: 'Data Prevista' }, { label: 'Paciente' }, { label: 'CPF' },
            { label: 'Exame' }, { label: 'Unidade' }, { label: 'Status' }, { label: 'Ações' }
        ],
        rowFormatter: (item) => {
            const c = item.cell;
            const btnImprimir = `<button title='Imprimir guia' data-action="print-guide" data-idp='${c[0]}' data-ids='${c[1]}'>🖨️</button>`;
            return `<tr>
                <td>${c[2]}</td><td>${c[3]}</td><td>${c[4]}</td>
                <td>${c[5]}</td><td>${c[6]}</td><td>${c[7]}</td><td>${btnImprimir}</td>
            </tr>`;
        },
        onRowButtonClick: async (event, data) => {
            if (data.action === 'print-guide') {
                try {
                    await api.fetchImprimirGuiaExame(data.idp, data.ids);
                } catch (e) {
                    logError(e, 'onRowButtonClick:print-guide');
                    ui.showToast(e.message, 'error');
                }
            }
        }
    });
}

function extrairProcedimentoOrigem(especialidade) {
  if (!especialidade) return { procedimento: '', origem: '' };
  const partes = especialidade.split('; /');
  return {
    procedimento: partes[0] ? partes[0].trim() : '',
    origem: partes[1] ? partes[1].replace(/^\s*Origem:\s*/i, '').trim() : '',
  };
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento || typeof dataNascimento !== 'string') return 'N/A';
  const partes = dataNascimento.split('/');
  if (partes.length !== 3) return 'N/A';
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const ano = parseInt(partes[2], 10);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return 'N/A';
  const hoje = new Date();
  const nascimento = new Date(ano, mes, dia);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade >= 0 ? idade : 'N/A';
}

function analisarStatusGestacional(gestanteData) {
    if (!gestanteData || !gestanteData.isGestante) {
        return { valor: 'Não', rotulo: 'Situação Gestacional', icone: '', classe: '' };
    }
    const { dpp, idadeGestacional } = gestanteData;
    const partes = dpp.split('/');
    if (partes.length !== 3) {
        return { valor: 'Sim', rotulo: 'Gestante (DPP inválida)', icone: '🤰', classe: 'gestante' };
    }
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const ano = parseInt(partes[2], 10);
    const dataProvavelParto = new Date(ano, mes, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (hoje <= dataProvavelParto) {
        return {
            valor: idadeGestacional.split(' ')[0],
            rotulo: 'Semanas Gestante',
            icone: '🤰',
            classe: 'gestante'
        };
    } else {
        const diffEmMs = hoje.getTime() - dataProvavelParto.getTime();
        const diffEmDias = Math.ceil(diffEmMs / (1000 * 60 * 60 * 24));
        if (diffEmDias <= 45) {
            return {
                valor: `${diffEmDias}`,
                rotulo: 'Dias no Puerpério',
                icone: '👶',
                classe: 'puerpera'
            };
        }
    }
    return { valor: 'Não', rotulo: 'Situação Gestacional', icone: '', classe: '' };
}
