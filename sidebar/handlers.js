import * as api from './api.js';
import * as ui from './ui.js';
import * as parser from './parser.js';
import { state, setCurrentUser, setSuggestions, setSelectedSuggestionIndex, setSearchHistory, setSettings } from './state.js';
import { logError } from './error-handler.js';

// Elementos do DOM
const inputBusca = document.getElementById('inputBusca');
const listaSugestoes = document.getElementById('listaSugestoes');
const resultadoEl = document.getElementById('resultado');

/**
 * Gestor para o evento de digitação no campo de busca.
 * Aciona a busca de sugestões ao pressionar Enter.
 * @param {KeyboardEvent} event - O evento do teclado.
 */
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
      resultadoEl.style.display = 'none';
    } finally {
      ui.setSessionSpinner('sessao-usuario', false);
    }
  }
}

/**
 * Gestor para a navegação por teclado na lista de sugestões.
 * @param {KeyboardEvent} event - O evento do teclado.
 */
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

/**
 * Lógica a ser executada quando uma sugestão é selecionada (via clique ou Enter).
 * @param {number} index - O índice da sugestão selecionada.
 */
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

/**
 * Limpa o conteúdo de todas as secções dinâmicas.
 */
function clearAllSections() {
    document.getElementById('cardUsuario').innerHTML = '';
    document.getElementById('dashboard-container').innerHTML = '';
    document.getElementById('compromissosTabela').innerHTML = '';
    document.getElementById('listaEsperaUsuario').innerHTML = '';
    document.getElementById('regulacaoPanel').innerHTML = '';
    document.getElementById('agendamentosExamePanel').innerHTML = '';
    const comparacaoSessao = document.getElementById("sessao-comparacao-cadsus");
    if (comparacaoSessao) comparacaoSessao.remove();
}

/**
 * Carrega as configurações do utilizador a partir do storage.
 */
export async function loadSettings() {
    chrome.storage.sync.get({ settings: { itemsPerPage: 15, prontuarioPeriodoPadrao: 'last_year' } }, (data) => {
        setSettings(data.settings);
    });
}

/**
 * Carrega e renderiza o histórico de pesquisas.
 */
export async function loadAndRenderHistory() {
    chrome.storage.local.get({ searchHistory: [] }, (data) => {
        setSearchHistory(data.searchHistory);
        renderHistory();
    });
}

/**
 * Adiciona um utilizador ao histórico de pesquisa e guarda-o.
 * @param {object} user - O objeto do utilizador a adicionar.
 */
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

/**
 * Renderiza a lista do histórico na UI.
 */
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

/**
 * Gestor para o clique num item do histórico.
 * @param {MouseEvent} event - O evento do clique.
 */
async function handleHistoryClick(event) {
    const { idp, ids } = event.target.dataset;
    clearAllSections();
    const fakeSuggestion = [idp, ids, '', '', '', event.target.title, '', ''];
    setSuggestions([fakeSuggestion]);
    handleSelectSuggestion(0);
}

/**
 * Renderiza o dashboard com estatísticas e ações para o utilizador.
 * @param {object} user - O objeto do utilizador.
 */
async function renderDashboard(user) {
    const container = document.getElementById('dashboard-container');
    ui.renderSkeleton(container, 1, 4); // Skeleton para os cards de dados

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

        // Aplica o valor padrão das configurações e adiciona o event listener
        document.getElementById('prontuario-periodo').value = state.settings.prontuarioPeriodoPadrao;
        if (hasCryptoKey) {
            document.getElementById('open-prontuario-btn').addEventListener('click', handleOpenProntuarioClick);
        }

    } catch (e) {
        logError(e, 'renderDashboard');
        container.innerHTML = `<div style="color: #c00; font-size: 12px; grid-column: 1 / -1;">Erro ao carregar dashboard.</div>`;
    }
}


/**
 * Gestor para o clique no botão "Abrir Prontuário".
 */
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

/**
 * Calcula as datas inicial e final com base no período selecionado.
 * @param {string} periodo - O valor do período (ex: 'last_year').
 * @returns {{dataInicial: string, dataFinal: string}}
 */
function calcularDatas(periodo) {
    const hoje = new Date();
    const dataFinal = hoje.toLocaleDateString('pt-BR');
    let dataInicial;

    if (periodo === 'last_6_months') {
        const dataPassada = new Date();
        dataPassada.setMonth(hoje.getMonth() - 6);
        dataInicial = dataPassada.toLocaleDateString('pt-BR');
    } else if (periodo === 'all_time') {
        // Usa uma data muito antiga para pegar "todo o período"
        dataInicial = '01/01/1900';
    } else { // Padrão é 'last_year'
        const dataPassada = new Date();
        dataPassada.setFullYear(hoje.getFullYear() - 1);
        dataInicial = dataPassada.toLocaleDateString('pt-BR');
    }
    return { dataInicial, dataFinal };
}

/**
 * Orquestra a renderização de todas as secções de dados para o utilizador.
 * @param {object} user - O objeto do utilizador.
 */
function renderAllSections(user) {
    renderDashboard(user);
    applyPatientTags(user); // Nova chamada para aplicar as tags
    renderComparacaoCadsus(user);
    renderCompromissos(user);
    renderListaEspera(user);
    renderRegulacoes(user);
    renderAgendamentosExame(user);
}

/**
 * Busca o prontuário, extrai os códigos e aplica as tags configuradas.
 * @param {object} user - O objeto do utilizador.
 */
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
      
      const codesInProntuario = parser.extractCodes(prontuarioText);
      
      if (codesInProntuario.size === 0) {
          container.innerHTML = '';
          return;
      }
  
      // Carrega as tags salvas e compara
      chrome.storage.sync.get({ clinicalTags: [] }, (data) => {
          const matchingTags = data.clinicalTags.filter(tag => 
              // LÓGICA ATUALIZADA para a nova estrutura de dados
              tag.codes.some(codeObj => codesInProntuario.has(codeObj.code))
          ).map(tag => tag.tagName);
          
          ui.renderPatientTags(matchingTags);
      });
  
    } catch (error) {
      logError(error, 'applyPatientTags');
      container.innerHTML = `<span style="font-size:12px; color:#c00;">Erro ao analisar tags.</span>`;
    }
}

/**
 * Busca e renderiza a comparação com o CADSUS.
 * @param {object} user - O objeto do utilizador.
 */
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

/**
 * Configura e renderiza a tabela de compromissos.
 * @param {object} user - O objeto do utilizador.
 */
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

/**
 * Configura e renderiza a tabela da lista de espera.
 * @param {object} user - O objeto do utilizador.
 */
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

/**
 * Configura e renderiza a tabela de regulações com filtros.
 * @param {object} user - O objeto do utilizador.
 */
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
                    // A UI de detalhes (modal) seria implementada aqui
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

/**
 * Configura e renderiza a tabela de agendamentos de exame.
 * @param {object} user - O objeto do utilizador.
 */
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

/**
 * Utilitário para separar procedimento e origem da especialidade.
 * @param {string} especialidade - O campo de especialidade da API.
 * @returns {{procedimento: string, origem: string}}
 */
function extrairProcedimentoOrigem(especialidade) {
  if (!especialidade) return { procedimento: '', origem: '' };
  const partes = especialidade.split('; /');
  return {
    procedimento: partes[0] ? partes[0].trim() : '',
    origem: partes[1] ? partes[1].replace(/^\s*Origem:\s*/i, '').trim() : '',
  };
}

/**
 * Calcula a idade a partir de uma data de nascimento no formato DD/MM/YYYY.
 * @param {string} dataNascimento - A data de nascimento.
 * @returns {number|string} A idade em anos ou 'N/A' se a data for inválida.
 */
function calcularIdade(dataNascimento) {
  if (!dataNascimento || typeof dataNascimento !== 'string') {
    return 'N/A';
  }
  const partes = dataNascimento.split('/');
  if (partes.length !== 3) {
    return 'N/A';
  }
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // Mês é base 0 no JS
  const ano = parseInt(partes[2], 10);

  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
      return 'N/A';
  }

  const hoje = new Date();
  const nascimento = new Date(ano, mes, dia);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade >= 0 ? idade : 'N/A';
}

/**
 * Analisa os dados da gestação para determinar o status (Gestante, Puérpera, N/A).
 * @param {object|null} gestanteData - Os dados retornados pela API fetchStatusGestante.
 * @returns {object} Um objeto com o status formatado para a UI.
 */
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
    hoje.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas as datas

    // Se a data do parto ainda não chegou
    if (hoje <= dataProvavelParto) {
        return {
            valor: idadeGestacional.split(' ')[0], // Pega apenas o número de semanas
            rotulo: 'Semanas Gestante',
            icone: '🤰',
            classe: 'gestante'
        };
    } else {
        // Se a data do parto já passou, verifica se está no puerpério (até 45 dias após)
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
