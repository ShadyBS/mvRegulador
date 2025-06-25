/**
 * @file Módulo de Gestores de Eventos (Handlers).
 * Contém a lógica principal da aplicação que responde às interações do utilizador,
 * orquestrando chamadas à API e atualizações da UI.
 */

import * as api from './api.js';
import * as ui from './ui.js';
import { state, setCurrentUser, setSuggestions, setSelectedSuggestionIndex } from './state.js';

const inputBusca = document.getElementById('inputBusca');
const listaSugestoes = document.getElementById('listaSugestoes');
const cardUsuario = document.getElementById('cardUsuario');
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
      console.error('Erro ao buscar sugestões:', error);
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

  // Limpa a UI
  cardUsuario.innerHTML = '';
  document.getElementById('compromissosTabela').innerHTML = '';
  document.getElementById('listaEsperaUsuario').innerHTML = '';
  document.getElementById('regulacaoPanel').innerHTML = '';
  document.getElementById('agendamentosExamePanel').innerHTML = '';

  ui.setSessionSpinner('sessao-usuario', true);
  try {
    const data = await api.fetchVisualizaUsuario({ idp, ids });
    
    if (data && data.usuarioServico) {
      setCurrentUser(data.usuarioServico);

      const fotoPath = data.usuarioServico.entidadeFisica?.foto;
      let fotoHTML = null;
      if (fotoPath) {
        const fotoSrc = fotoPath.startsWith('/') ? `http://saude.farroupilha.rs.gov.br${fotoPath}` : `http://saude.farroupilha.rs.gov.br/sigss/${fotoPath}`;
        fotoHTML = `<div class="foto-usuario-container"><img src="${fotoSrc}" alt="Foto do usuário" class="foto-usuario" onerror="this.style.display='none'" /></div>`;
      }
      ui.renderUserCard(state.currentUser, fotoHTML);
      
      renderAllSections(state.currentUser);
    } else {
      ui.showToast('Detalhes do utilizador não encontrados.', 'error');
    }
  } catch (error) {
    console.error('Erro ao selecionar sugestão:', error);
    ui.showToast(`Erro ao buscar detalhes: ${error.message}`, 'error');
  } finally {
    ui.setSessionSpinner('sessao-usuario', false);
  }
}

/**
 * Orquestra a renderização de todas as secções de dados para o utilizador.
 * @param {object} user - O objeto do utilizador.
 */
function renderAllSections(user) {
    renderComparacaoCadsus(user);
    renderCompromissos(user);
    renderListaEspera(user);
    renderRegulacoes(user);
    // A secção de Agendamentos de Exame será implementada depois
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
        apiParams: { isenPK: api.getUsuarioFullPK(user), dataInicial, dataFinal },
        columns: [
            { key: 'data', label: 'Data' },
            { key: 'hora', label: 'Hora' },
            { key: 'unidade', label: 'Unidade' },
            { key: 'profissional', label: 'Profissional' },
            { key: 'procedimento', label: 'Procedimento' },
            { key: 'faltou', label: 'Faltou?' },
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
        apiParams: { isenPK: api.getUsuarioFullPK(user) },
        columns: [
            { label: 'Situação' }, { label: 'Tipo' }, { label: 'Gravidade' }, 
            { label: 'Data Entrada' }, { label: 'Procedimento' }, { label: 'Origem' }, { label: 'Ações' }
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
                } catch (e) { ui.showToast(e.message, 'error'); }
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
        apiParams: { usuario: user },
        filters: [
            {
                type: 'select',
                name: 'status',
                options: [
                    { value: '', label: 'Todos os Status' },
                    { value: 'AUTORIZADO', label: 'Autorizado' },
                    { value: 'PENDENTE', label: 'Pendente' },
                    { value: 'DEVOLVIDO', label: 'Devolvido' },
                    { value: 'NEGADO', label: 'Negado' },
                    { value: 'CANCELADA', label: 'Cancelado' },
                ]
            }
        ],
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
        onRowButtonClick: (event, data) => {
            if (data.action === 'details') {
                // Lógica do modal de detalhes
                ui.showToast(`Detalhes para Regulação ID: ${data.idp}`, 'info');
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

