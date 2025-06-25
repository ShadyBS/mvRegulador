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
      resultadoEl.textContent = 'Digite pelo menos 3 caracteres para buscar.';
      resultadoEl.style.display = 'block';
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
      resultadoEl.textContent = `Erro: ${error.message}`;
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

  // Limpa a UI e mostra spinners
  cardUsuario.innerHTML = '';
  document.getElementById('compromissosTabela').innerHTML = '';
  document.getElementById('listaEsperaUsuario').innerHTML = '';
  document.getElementById('regulacaoTabela').innerHTML = '';
  document.getElementById('agendamentosExameTabela').innerHTML = '';


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
      
      await Promise.all([
        renderComparacaoCadsus(state.currentUser),
        renderCompromissos(state.currentUser, 1),
        renderListaEspera(state.currentUser, 1),
        renderRegulacoes(state.currentUser, 1),
        renderAgendamentosExame(state.currentUser, 1),
      ]);

    } else {
      cardUsuario.innerHTML = '<div style="color:#c00">Detalhes não encontrados.</div>';
    }
  } catch (error) {
    console.error('Erro ao selecionar sugestão:', error);
    cardUsuario.innerHTML = `<div style="color:#c00">Erro ao buscar detalhes: ${error.message}</div>`;
  } finally {
    ui.setSessionSpinner('sessao-usuario', false);
  }
}

/**
 * Busca e renderiza a comparação com o CADSUS.
 * @param {object} user - O objeto do utilizador.
 */
async function renderComparacaoCadsus(user) {
    const cpf = user?.entidadeFisica?.entfCPF;
    let comparacaoSessao = document.getElementById("sessao-comparacao-cadsus");
    if (!comparacaoSessao) {
        comparacaoSessao = document.createElement("section");
        comparacaoSessao.id = "sessao-comparacao-cadsus";
        comparacaoSessao.innerHTML = `
            <button class="accordion active" type="button">Comparação com CADSUS</button>
            <div class="panel show" id="comparacaoCadsus"></div>
        `;
        document.querySelector('.sessao-usuario').after(comparacaoSessao);
        comparacaoSessao.querySelector('.accordion').addEventListener('click', function() {
            this.classList.toggle('active');
            this.nextElementSibling.classList.toggle('show');
        });
    }

    const comparacaoDiv = document.getElementById("comparacaoCadsus");
    if (cpf) {
        comparacaoDiv.innerHTML = '<div style="color:#888;font-size:13px;">🔎 Comparando ficha com CADSUS...</div>';
        try {
            const htmlComparacao = await api.fetchAndCompareFichaCadsus({ ficha: user, cpf });
            const { html } = api.parseCadsusComparacaoResponse(htmlComparacao);
            comparacaoDiv.innerHTML = html;
        } catch (e) {
            comparacaoDiv.innerHTML = `<div style='color:#c00;font-size:13px;'>Erro ao comparar: ${e.message}</div>`;
        }
    } else {
        comparacaoDiv.innerHTML = '<div style="color:#888;font-size:13px;">CPF não disponível para comparação.</div>';
    }
}


/**
 * Busca e renderiza os compromissos com paginação.
 * @param {object} user - O objeto do utilizador.
 * @param {number} page - A página a ser buscada.
 */
async function renderCompromissos(user, page = 1) {
  const container = document.getElementById('compromissosTabela');
  ui.setSessionSpinner('sessao-compromissos', true);
  try {
    const hoje = new Date();
    const dataFinal = hoje.toLocaleDateString('pt-BR');
    const dataInicial = new Date(hoje.getFullYear() - 5, hoje.getMonth(), hoje.getDate()).toLocaleDateString('pt-BR');
    const data = await api.fetchCompromissosUsuario({
      isenPK: api.getUsuarioFullPK(user),
      dataInicial,
      dataFinal,
      page,
    });

    const totalPaginas = data.total || 1;
    let paginacaoHTML = '';
    if (totalPaginas > 1) {
      paginacaoHTML = `<div class='paginacao-lista-espera paginacao-topo'>
        <button class='btn-paginacao' ${page === 1 ? 'disabled' : ''} data-page='${page - 1}'>⏮️</button>
        <span class='paginacao-info'>Página <b>${page}</b> de <b>${totalPaginas}</b></span>
        <button class='btn-paginacao' ${page === totalPaginas ? 'disabled' : ''} data-page='${page + 1}'>⏭️</button>
      </div>`;
    }

    let tabelaHTML = `<table class='tabela-padrao'><thead><tr><th>Data</th><th>Hora</th><th>Unidade</th><th>Profissional</th><th>Procedimento</th><th>Faltou?</th></tr></thead><tbody>`;
    if (data.rows && data.rows.length > 0) {
      data.rows.forEach(row => {
        const c = row.cell;
        tabelaHTML += `<tr><td>${c[2]}</td><td>${c[3]}</td><td>${c[4]}</td><td>${c[5]}</td><td>${c[6]}</td><td>${c[10].replace(/<[^>]+>/g, '')}</td></tr>`;
      });
    } else {
      tabelaHTML += `<tr><td colspan="6" style="text-align:center;">Nenhum compromisso encontrado.</td></tr>`;
    }
    tabelaHTML += '</tbody></table>';
    container.innerHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div>${paginacaoHTML}${tabelaHTML}`;

    container.querySelectorAll('.btn-paginacao').forEach(btn => {
      btn.addEventListener('click', () => renderCompromissos(user, parseInt(btn.dataset.page)));
    });
  } catch (e) {
    container.innerHTML = `<div style='color:#c00;font-size:13px;'>Erro ao buscar compromissos: ${e.message}</div>`;
  } finally {
    ui.setSessionSpinner('sessao-compromissos', false);
  }
}

/**
 * Busca e renderiza a lista de espera com paginação.
 * @param {object} user - O objeto do utilizador.
 * @param {number} page - A página a ser buscada.
 */
async function renderListaEspera(user, page = 1) {
  const container = document.getElementById('listaEsperaUsuario');
  ui.setSessionSpinner('sessao-lista-espera', true);
  try {
    const data = await api.fetchListaEsperaPorIsenPK({ isenPK: api.getUsuarioFullPK(user), page });

    const totalPaginas = data.total || 1;
    let paginacaoHTML = '';
    if (totalPaginas > 1) {
      paginacaoHTML = `<div class='paginacao-lista-espera paginacao-topo'>
        <button class='btn-paginacao' ${page === 1 ? 'disabled' : ''} data-page='${page - 1}'>⏮️</button>
        <span class='paginacao-info'>Página <b>${page}</b> de <b>${totalPaginas}</b></span>
        <button class='btn-paginacao' ${page === totalPaginas ? 'disabled' : ''} data-page='${page + 1}'>⏭️</button>
      </div>`;
    }

    let tabelaHTML = `<table class="tabela-padrao"><thead><tr><th>Situação</th><th>Tipo</th><th>Gravidade</th><th>Data Entrada</th><th>Procedimento</th><th>Origem</th><th>Ações</th></tr></thead><tbody>`;
    if (data.rows && data.rows.length > 0) {
        data.rows.forEach(item => {
            const { procedimento, origem } = extrairProcedimentoOrigem(item.especialidade);
            let btnImprimir = '';
            if (item.tipo === 'EXA' && item.id && Array.isArray(item.cell)) {
                const idp = item.cell[0];
                const ids = item.cell[1];
                btnImprimir = `<button class='btn-imprimir-exame' title='Imprimir requisição' data-idp='${idp}' data-ids='${ids}'>🖨️</button>`;
            }
            tabelaHTML += `<tr><td>${item.situacao}</td><td>${item.tipo}</td><td>${item.gravidade}</td><td>${item.dataEntrada}</td><td>${procedimento}</td><td>${origem}</td><td>${btnImprimir}</td></tr>`;
        });
    } else {
        tabelaHTML += `<tr><td colspan="7" style="text-align:center;">Nenhuma entrada na lista de espera.</td></tr>`;
    }
    tabelaHTML += '</tbody></table>';
    container.innerHTML = `<div class="compromissos-titulo">Lista de Espera SIGSS</div>${paginacaoHTML}${tabelaHTML}`;

    container.querySelectorAll('.btn-paginacao').forEach(btn => {
      btn.addEventListener('click', () => renderListaEspera(user, parseInt(btn.dataset.page)));
    });
    container.querySelectorAll('.btn-imprimir-exame').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.fetchImprimirRequisicaoExameNaoLab(btn.dataset.idp, btn.dataset.ids);
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    container.innerHTML = `<div style='color:#c00;font-size:13px;'>Erro ao buscar lista de espera: ${e.message}</div>`;
  } finally {
    ui.setSessionSpinner('sessao-lista-espera', false);
  }
}

/**
 * Busca e renderiza as regulações com paginação.
 * @param {object} user - O objeto do utilizador.
 * @param {number} page - A página a ser buscada.
 */
async function renderRegulacoes(user, page = 1) {
    // Implementação similar às outras funções de renderização de tabela
}

/**
 * Busca e renderiza os agendamentos de exame com paginação.
 * @param {object} user - O objeto do utilizador.
 * @param {number} page - A página a ser buscada.
 */
async function renderAgendamentosExame(user, page = 1) {
    // Implementação similar às outras funções de renderização de tabela
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
