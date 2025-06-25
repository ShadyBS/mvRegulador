/**
 * @file Módulo da API.
 * Contém todas as funções para interagir com os endpoints do SIGSS.
 * Todas as funções são exportadas para serem usadas em outros módulos.
 */

/**
 * Buscar usuários/serviços usando filtros
 * @param {Object} params - Parâmetros de busca (ex: nome, cpf, dataNascimento, etc)
 * @returns {Promise<Object>} Lista de usuários/serviços
 */
export async function buscarUsuarioServico(params) {
  const urlBase =
    'http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/listar';
  const query = new URLSearchParams(params).toString();
  const url = `${urlBase}?${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json; charset=iso-8859-1',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar dados: ' + response.status);
  }
  return response.json();
}

/**
 * Buscar usuários por termo genérico (nome, CPF, CNS, etc)
 * @param {Object} options
 * @param {string} options.searchString - Termo de busca
 * @returns {Promise<Object>} Lista de sugestões
 */
export async function fetchBuscarUsuarioGenerico({ searchString }) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/busca?searchString=${encodeURIComponent(
    searchString
  )}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar dados: ' + response.status);
  }
  return response.json();
}

/**
 * Buscar detalhes completos do usuário
 * @param {Object} options
 * @param {string} options.idp - isenPK.idp do usuário
 * @param {string} options.ids - isenPK.ids do usuário
 * @returns {Promise<Object>} Dados completos do usuário
 */
export async function fetchVisualizaUsuario({ idp, ids }) {
  const url =
    'http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/visualiza';
  const body = `isenPK.idp=${encodeURIComponent(
    idp
  )}&isenPK.ids=${encodeURIComponent(ids)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
    body,
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar detalhes do usuário: ' + response.status);
  }
  return response.json();
}

/**
 * Busca dados do CADSUS pelo CPF, compara com a ficha local e retorna HTML com o resultado
 * @param {Object} options
 * @param {Object} options.ficha - Objeto da ficha local do usuário
 * @param {string} options.cpf - CPF do usuário
 * @returns {Promise<string>} HTML formatado com o resultado da comparação
 */
export async function fetchAndCompareFichaCadsus({ ficha, cpf }) {
  try {
    const urlCadsus = `http://saude.farroupilha.rs.gov.br/sigss/usuarioServicoConsultaPDQ/consultarPaciente?_search=false&rows=50&page=1&sidx=nome&sord=asc&pdq.cartaoNacionalSus=&pdq.cpf=${encodeURIComponent(
      cpf
    )}&pdq.rg=&pdq.nome=&pdq.dataNascimento=&pdq.sexo=&pdq.nomeMae=`;
    const respCadsus = await fetch(urlCadsus, {
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6',
        'content-type': 'application/json; charset=iso-8859-1',
        'x-requested-with': 'XMLHttpRequest',
      },
      referrer: 'http://saude.farroupilha.rs.gov.br/sigss/cadastroPaciente.jsp',
      referrerPolicy: 'strict-origin-when-cross-origin',
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    });
    const cadsusData = await respCadsus.json();
    if (!cadsusData.rows || cadsusData.rows.length === 0) {
      return `<div style='color:#F90000;font-weight:bold;'>Usuário não encontrado no CADSUS pelo CPF.</div>`;
    }
    const cell = cadsusData.rows[0].cell;
    function normalizarTelefone(tel) {
      let t = (tel || '').replace(/\D/g, '');
      if (t.length > 10 && t.startsWith('55')) t = t.slice(2);
      return t;
    }
    const campos = [
        { nome: 'Nome', valor1: ficha.entidadeFisica?.entidade?.entiNome || '', valor2: cell[2] || '' },
        { nome: 'Nome da Mãe', valor1: ficha.entidadeFisica?.entfNomeMae || '', valor2: cell[7] || '' },
        { nome: 'Nome do Pai', valor1: ficha.entidadeFisica?.entfNomePai || '', valor2: cell[8] || '' },
        { nome: 'Data de Nascimento', valor1: ficha.entidadeFisica?.entfDtNasc || '', valor2: cell[3] || '' },
        { nome: 'Sexo', valor1: ficha.entidadeFisica?.entfSexo || '', valor2: cell[9] || '' },
        { nome: 'Raça/Cor', valor1: ficha.entidadeFisica?.racaCor?.racoNome || '', valor2: cell[11] || '' },
        { nome: 'CNS', valor1: ficha.isenNumCadSus || '', valor2: cell[65] || '' },
        { nome: 'CPF', valor1: ficha.entidadeFisica?.entfCPF || '', valor2: cell[50] || '' },
        { nome: 'RG', valor1: ficha.entidadeFisica?.entfRG || '', valor2: cell[51] || '' },
        { nome: 'E-mail', valor1: ficha.entidadeFisica?.entidade?.entiEmail || '', valor2: cell[49] || '' },
        { nome: 'Telefone 1', valor1: normalizarTelefone((ficha.entidadeFisica?.entidade?.entiTel1Pre || '') + (ficha.entidadeFisica?.entidade?.entiTel1 || '')), valor2: normalizarTelefone(cell[16] || '') },
        { nome: 'Telefone 2', valor1: normalizarTelefone((ficha.entidadeFisica?.entidade?.entiTel2Pre || '') + (ficha.entidadeFisica?.entidade?.entiTel2 || '')), valor2: normalizarTelefone(cell[17] || '') },
        { nome: 'Telefone 3', valor1: normalizarTelefone((ficha.entidadeFisica?.entidade?.entiTelCelularPre || '') + (ficha.entidadeFisica?.entidade?.entiTelCelular || '')), valor2: normalizarTelefone(cell[19] || '') },
        { nome: 'Município de Residência', valor1: ficha.entidadeFisica?.entidade?.localidade?.cidade?.cidaNome || '', valor2: cell[29] || '' },
        { nome: 'Bairro', valor1: ficha.entidadeFisica?.entidade?.localidade?.locaNome || '', valor2: cell[39] || '' },
    ];
    let html = `<table class='resposta-tabela'><tr><th>Campo</th><th>Ficha</th><th>CADSUS</th></tr>`;
    let diferentes = 0;
    campos.forEach((c) => {
      const diff = (c.valor1 || '').trim() !== (c.valor2 || '').trim();
      if (diff) diferentes++;
      html += `<tr${diff ? " style='background:#ffeaea;'" : ''}><td>${c.nome}</td><td>${c.valor1 || '-'}</td><td>${c.valor2 || '-'}</td></tr>`;
    });
    html += `</table>`;
    if (diferentes === 0) {
      html = `<div style='color:#278B77;font-weight:bold;margin-bottom:8px;'>Todos os dados conferem! ✔️</div>` + html;
    } else {
      html = `<div style='color:#F90000;font-weight:bold;margin-bottom:8px;'>Atenção: Existem diferenças nos campos destacados!</div>` + html;
    }
    return html;
  } catch (e) {
    return `<div style='color:#F90000;font-weight:bold;'>Erro ao consultar ficha ou CADSUS do paciente.</div>`;
  }
}

/**
 * Interpreta a resposta da comparação CADSUS, detectando erros em HTML ou JSON e retornando objeto padronizado
 * @param {string} resposta - HTML ou JSON retornado por fetchAndCompareFichaCadsus
 * @returns {{ erro: boolean, mensagem: string, html: string }}
 */
export function parseCadsusComparacaoResponse(resposta) {
  if (
    typeof resposta === 'string' &&
    (resposta.includes('Erro ao consultar ficha') ||
      resposta.includes('Usuário não encontrado no CADSUS'))
  ) {
    return {
      erro: true,
      mensagem: resposta,
      html: `<div style='color:#c00;font-size:13px;'>${resposta}</div>`,
    };
  }
  try {
    const parsed = JSON.parse(resposta);
    if (parsed && parsed.mensagem && parsed.categoria === 'error') {
      return {
        erro: true,
        mensagem: parsed.mensagem,
        html: `<div style='color:#c00;font-size:13px;'>${parsed.mensagem}</div>`,
      };
    }
  } catch {}
  return { erro: false, mensagem: '', html: resposta };
}

/**
 * Busca detalhes de uma regulação pelo idp e ids
 * @param {object} param0
 * @returns {Promise<object>}
 */
export async function fetchDetalhesRegulacao({ idp, ids }) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/regulacaoControleSolicitacao/visualiza?reguPK.idp=${idp}&reguPK.ids=${ids}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
    referrer: 'http://saude.farroupilha.rs.gov.br/sigss/regulacaoRegulador.jsp',
    referrerPolicy: 'strict-origin-when-cross-origin',
    mode: 'cors',
  });
  return await response.json();
}

/**
 * Buscar compromissos do usuário por isenPK e período, com paginação e ordenação
 * @param {Object} options
 * @returns {Promise<Object>} Objeto com os compromissos encontrados
 */
export async function fetchCompromissosUsuario({
  isenPK,
  dataInicial,
  dataFinal,
  page = 1,
  rows = 15,
  sidx = 'data',
  sord = 'desc',
}) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/resumoCompromisso/lista?isenPK=${encodeURIComponent(
    isenPK
  )}&dataInicial=${encodeURIComponent(
    dataInicial
  )}&dataFinal=${encodeURIComponent(
    dataFinal
  )}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json; charset=iso-8859-1',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar compromissos: ' + response.status);
  }
  return response.json();
}

/**
 * Buscar lista de espera do SIGSS por isenPK (fullPK) com paginação e ordenação
 * @param {Object} options
 * @returns {Promise<Object>} Objeto com total, page, records, rows
 */
export async function fetchListaEsperaPorIsenPK({
  isenPK,
  page = 1,
  rows = 15,
  sidx = 'lies.liesData',
  sord = 'desc',
}) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/listaEspera/listar?filters%5B0%5D=isFiltrarData%3Afalse&filters%5B1%5D=dataInicial%3A&filters%5B2%5D=dataFinal%3A&filters%5B3%5D=limoPK%3A&filters%5B4%5D=liesTipo%3A&filters%5B5%5D=liesSituacao%3ATOD&filters%5B6%5D=isenPK%3A${isenPK}&filters%5B7%5D=apcnId%3A&filters%5B8%5D=prsaPK%3A&filters%5B9%5D=prciPK%3A&filters%5B10%5D=prsaSolicitantePK%3A&filters%5B11%5D=benePK%3A&filters%5B12%5D=deprPK%3A&filters%5B13%5D=clienteId%3A&filters%5B14%5D=prefeituraPK%3A&filters%5B15%5D=isFiltrarDatas%3Afalse&filters%5B16%5D=dataI%3A&filters%5B27%5D=dataF%3A&filters%5B28%5D=tufgId%3A&filters%5B29%5D=tusgId%3A&filters%5B30%5D=isenIsBloqueado%3A&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json; charset=iso-8859-1',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar lista de espera');
  }
  const data = await response.json();
  return {
    total: data.total || 1,
    page: data.page || 1,
    records: data.records || 0,
    rows: (data.rows || []).map((row) => {
      const c = row.cell;
      return {
        id: row.id,
        cell: c, // Passa a célula inteira para uso posterior
        situacao: c[2],
        tipo: c[3],
        gravidade: c[4],
        codigo: c[5],
        nome: c[6],
        idade: c[7],
        dataEntrada: c[8],
        especialidade: c[10]?.replace(/<br\s*\/?>(?!$)/gi, ' / '),
      };
    }),
  };
}

/**
 * Utilitário para obter o fullPK do usuário a partir de diferentes estruturas
 * @param {Object} usuario
 * @returns {string|null}
 */
export function getUsuarioFullPK(usuario) {
  if (!usuario) return null;
  if (usuario.fullPK) return usuario.fullPK;
  if (usuario.isenPK) return usuario.isenPK;
  if (usuario.idp && usuario.ids) return `${usuario.idp}-${usuario.ids}`;
  return null;
}

/**
 * Buscar regulações do usuário (RegulaçãoRegulador) com filtros customizáveis
 * @param {Object} options
 * @returns {Promise<Object>} Objeto com as regulações encontradas
 */
export async function fetchRegulacaoRegulador({
  usuario,
  filtros,
  page = 1,
  rows = 15,
  sidx = 'regu.reguDataPrevista',
  sord = 'desc',
}) {
  const usuarioPK = getUsuarioFullPK(usuario);
  const defaultFilters = {
    isFiltrarData: 'false',
    dataInicial: '',
    dataFinal: '',
    modalidade: '',
    solicitante: 'undefined',
    usuarioServico: usuarioPK,
    autorizado: 'false', pendente: 'false', devolvido: 'false', negado: 'false', emAnalise: 'false', cancelados: 'false',
    cboFiltro: '', procedimentoFiltro: '', reguGravidade: '', reguIsRetorno: '', codBarProtocolo: '', reguIsAgendadoFiltro: 'todos',
  };
  const mergedFilters = { ...defaultFilters, ...(filtros || {}) };
  const filterParams = Object.entries(mergedFilters)
      .map(([key, value], idx) => `filters%5B${idx}%5D=${encodeURIComponent(key)}%3A${encodeURIComponent(value)}`)
      .join('&');

  const url = `http://saude.farroupilha.rs.gov.br/sigss/regulacaoRegulador/lista?${filterParams}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar regulações: ' + response.status);
  }
  return response.json();
}

/**
 * Buscar agendamentos de exame no SIGSS
 * @param {Object} options
 * @returns {Promise<Object>} Objeto com os agendamentos encontrados
 */
export async function fetchAgendamentosExame({
  searchField = 'isen.isenCod',
  isExameTipo = 'ambos',
  searchString = '',
  searchStringBuscaUsuServico = '',
  filters = {},
  page = 1,
  rows = 15,
  sidx = 'itex.itexDataPrevista',
  sord = 'desc',
} = {}) {
  const defaultFilters = { isFiltrarData: 'false', dataInicial: '', dataFinal: '', isFiltrarDataNasc: 'false', dataNascInicial: '', dataNascFinal: '', isFiltrarIdade: 'false', idadeInicial: '', idadeFinal: '' };
  const allFilters = { ...defaultFilters, ...filters };
  const filtersParams = Object.entries(allFilters).map(([k, v], i) => `filters%5B${i}%5D=${encodeURIComponent(k + ':' + v)}`).join('&');
  const url = `http://saude.farroupilha.rs.gov.br/sigss/agendamentoExame/listar?searchField=${encodeURIComponent(searchField)}&isExameTipo=${encodeURIComponent(isExameTipo)}&searchString=${encodeURIComponent(searchString)}&searchStringBuscaUsuServico=${encodeURIComponent(searchStringBuscaUsuServico)}&${filtersParams}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(sidx)}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Erro ao buscar agendamentos de exame: ' + response.status);
  }
  return response.json();
}

/**
 * Função para imprimir guia de exame agendado
 * @param {string} idp - idp do item do exame
 * @param {string} ids - ids do item do exame
 */
export async function fetchImprimirGuiaExame(idp, ids) {
    const params = new URLSearchParams();
    params.append("filters[0]", `examIdp:${idp}`);
    params.append("filters[1]", `examIds:${ids}`);
    const response = await fetch(
      "http://saude.farroupilha.rs.gov.br/sigss/itemExame/imprimirGuia",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: params.toString(),
        credentials: "include",
      }
    );
    const data = await response.json();
    if (data && data.report) {
      window.open("http://saude.farroupilha.rs.gov.br" + data.report, "_blank");
    } else {
      throw new Error("Não foi possível gerar a guia do exame.");
    }
}

/**
 * Função para imprimir requisição de exame não laboratorial da lista de espera
 * @param {string} idp - idp da lista de espera
 * @param {string} ids - ids da lista de espera
 */
export async function fetchImprimirRequisicaoExameNaoLab(idp, ids) {
    const params = new URLSearchParams();
    params.append('lies.liesPK.idp', idp);
    params.append('lies.liesPK.ids', ids);
    const response = await fetch('http://saude.farroupilha.rs.gov.br/sigss/requerimentoExame/imprimirRequerimentoExameNaoLabByLies', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: params.toString(),
      credentials: 'include',
    });
    const data = await response.json();
    if (data && data.report) {
      window.open('http://saude.farroupilha.rs.gov.br' + data.report, '_blank');
    } else {
      throw new Error("Não foi possível gerar a requisição.");
    }
}
