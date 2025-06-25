/**
 * Buscar usuários/serviços usando filtros
 * @param {Object} params - Parâmetros de busca (ex: nome, cpf, dataNascimento, etc)
 * @returns {Promise<Object>} Lista de usuários/serviços
 * Exemplos de params:
 *   {
 *     nome: 'João',
 *     cpf: '12345678900',
 *     dataNascimento: '01/01/1990',
 *     ...
 *   }
 */
async function buscarUsuarioServico(params) {
  const urlBase =
    "http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/listar";
  const query = new URLSearchParams(params).toString();
  const url = `${urlBase}?${query}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar dados: " + response.status);
  }
  return response.json();
}

/**
 * Buscar usuários por termo genérico (nome, CPF, CNS, etc)
 * @param {Object} options
 * @param {string} options.searchString - Termo de busca
 * @returns {Promise<Object>} Lista de sugestões
 */
async function fetchBuscarUsuarioGenerico({ searchString }) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/busca?searchString=${encodeURIComponent(
    searchString
  )}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
    },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar dados: " + response.status);
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
async function fetchVisualizaUsuario({ idp, ids }) {
  const url =
    "http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/visualiza";
  const body = `isenPK.idp=${encodeURIComponent(
    idp
  )}&isenPK.ids=${encodeURIComponent(ids)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    credentials: "include",
    body,
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar detalhes do usuário: " + response.status);
  }
  return response.json();
}

/**
 * Buscar foto do usuário por código da pessoa (retorna base64)
 * @param {Object} options
 * @param {string} options.codigoPessoa - Código da pessoa
 * @returns {Promise<string>} Base64 da imagem
 */
async function fetchFotoUsuario({ codigoPessoa }) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/usuarioServico/visualizaFoto?codigoPessoa=${encodeURIComponent(
    codigoPessoa
  )}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "image/jpeg,image/png,image/webp,*/*",
      "x-requested-with": "XMLHttpRequest",
    },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar foto: " + response.status);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob); // Retorna data:image/jpeg;base64,...
  });
}

/**
 * Buscar foto do usuário por URL (path completo ou relativo)
 * @param {Object} options
 * @param {string} options.fotoPath - Caminho da foto (relativo ou absoluto)
 * @returns {Promise<string|null>} Base64 da imagem ou null
 */
async function fetchFotoUsuarioPorPath({ fotoPath }) {
  if (!fotoPath) return null;
  let url = fotoPath;
  if (fotoPath.startsWith("/")) {
    url = "http://saude.farroupilha.rs.gov.br" + fotoPath;
  }
  const resp = await fetch(url, {
    headers: {
      accept:
        "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
    },
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/cadastroPaciente.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
  if (!resp.ok) return null;
  const finalUrl = resp.url;
  if (finalUrl.includes("/sigss/img/fotoPessoa2.png")) return null;
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Busca dados do CADSUS pelo CPF, compara com a ficha local e retorna HTML com o resultado
 * @param {Object} options
 * @param {Object} options.ficha - Objeto da ficha local do usuário
 * @param {string} options.cpf - CPF do usuário
 * @returns {Promise<string>} HTML formatado com o resultado da comparação
 */
async function fetchAndCompareFichaCadsus({ ficha, cpf }) {
  try {
    // 1. Buscar dados do CADSUS pelo CPF
    const urlCadsus = `http://saude.farroupilha.rs.gov.br/sigss/usuarioServicoConsultaPDQ/consultarPaciente?_search=false&rows=50&page=1&sidx=nome&sord=asc&pdq.cartaoNacionalSus=&pdq.cpf=${encodeURIComponent(
      cpf
    )}&pdq.rg=&pdq.nome=&pdq.dataNascimento=&pdq.sexo=&pdq.nomeMae=`;
    const respCadsus = await fetch(urlCadsus, {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
        "content-type": "application/json; charset=iso-8859-1",
        "x-requested-with": "XMLHttpRequest",
      },
      referrer: "http://saude.farroupilha.rs.gov.br/sigss/cadastroPaciente.jsp",
      referrerPolicy: "strict-origin-when-cross-origin",
      method: "GET",
      mode: "cors",
      credentials: "include",
    });
    const cadsusData = await respCadsus.json();
    if (!cadsusData.rows || cadsusData.rows.length === 0) {
      return `<div style='color:#F90000;font-weight:bold;'>Usuário não encontrado no CADSUS pelo CPF.</div>`;
    }
    const cell = cadsusData.rows[0].cell;
    // Função auxiliar para normalizar telefones (remove tudo exceto dígitos e DDI 55 do início)
    function normalizarTelefone(tel) {
      let t = (tel || "").replace(/\D/g, "");
      if (t.length > 10 && t.startsWith("55")) t = t.slice(2);
      return t;
    }
    // Comparação expandida
    const campos = [
      {
        nome: "Nome",
        valor1: ficha.entidadeFisica?.entidade?.entiNome || "",
        valor2: cell[2] || "",
      },
      {
        nome: "Nome da Mãe",
        valor1: ficha.entidadeFisica?.entfNomeMae || "",
        valor2: cell[7] || "",
      },
      {
        nome: "Nome do Pai",
        valor1: ficha.entidadeFisica?.entfNomePai || "",
        valor2: cell[8] || "",
      },
      {
        nome: "Data de Nascimento",
        valor1: ficha.entidadeFisica?.entfDtNasc || "",
        valor2: cell[3] || "",
      },
      {
        nome: "Sexo",
        valor1: ficha.entidadeFisica?.entfSexo || "",
        valor2: cell[9] || "",
      },
      {
        nome: "Raça/Cor",
        valor1: ficha.entidadeFisica?.racaCor?.racoNome || "",
        valor2: cell[11] || "",
      },
      {
        nome: "CNS",
        valor1: ficha.isenNumCadSus || "",
        valor2: cell[65] || "",
      },
      {
        nome: "CPF",
        valor1: ficha.entidadeFisica?.entfCPF || "",
        valor2: cell[50] || "",
      },
      {
        nome: "RG",
        valor1: ficha.entidadeFisica?.entfRG || "",
        valor2: cell[51] || "",
      },
      {
        nome: "E-mail",
        valor1: ficha.entidadeFisica?.entidade?.entiEmail || "",
        valor2: cell[49] || "",
      },
      {
        nome: "Telefone 1",
        valor1: normalizarTelefone(
          (ficha.entidadeFisica?.entidade?.entiTel1Pre || "") +
            (ficha.entidadeFisica?.entidade?.entiTel1 || "")
        ),
        valor2: normalizarTelefone(cell[16] || ""),
      },
      {
        nome: "Telefone 2",
        valor1: normalizarTelefone(
          (ficha.entidadeFisica?.entidade?.entiTel2Pre || "") +
            (ficha.entidadeFisica?.entidade?.entiTel2 || "")
        ),
        valor2: normalizarTelefone(cell[17] || ""),
      },
            {
        nome: "Telefone 3",
        valor1: normalizarTelefone(
          (ficha.entidadeFisica?.entidade?.entiTelCelularPre || "") +
            (ficha.entidadeFisica?.entidade?.entiTelCelular || "")
        ),
        valor2: normalizarTelefone(cell[19] || ""),
      },
      {
        nome: "Município de Residência",
        valor1:
          ficha.entidadeFisica?.entidade?.localidade?.cidade?.cidaNome || "",
        valor2: cell[29] || "",
      },
      {
        nome: "Bairro",
        valor1: ficha.entidadeFisica?.entidade?.localidade?.locaNome || "",
        valor2: cell[39] || "",
      },
    ];
    let html = `<table class='resposta-tabela'><tr><th>Campo</th><th>Ficha</th><th>CADSUS</th></tr>`;
    let diferentes = 0;
    campos.forEach((c) => {
      const diff = (c.valor1 || "").trim() !== (c.valor2 || "").trim();
      if (diff) diferentes++;
      html += `<tr${diff ? " style='background:#ffeaea;'" : ""}><td>${
        c.nome
      }</td><td>${c.valor1 || "-"}<\/td><td>${c.valor2 || "-"}<\/td><\/tr>`;
    });
    html += `</table>`;
    if (diferentes === 0) {
      html =
        `<div style='color:#278B77;font-weight:bold;margin-bottom:8px;'>Todos os dados conferem! ✔️</div>` +
        html;
    } else {
      html =
        `<div style='color:#F90000;font-weight:bold;margin-bottom:8px;'>Atenção: Existem diferenças nos campos destacados!</div>` +
        html;
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
function parseCadsusComparacaoResponse(resposta) {
  // Detecta erro em HTML
  if (
    typeof resposta === "string" &&
    (resposta.includes("Erro ao consultar ficha") ||
      resposta.includes("Usuário não encontrado no CADSUS"))
  ) {
    return {
      erro: true,
      mensagem: resposta,
      html: `<div style='color:#c00;font-size:13px;'>${resposta}</div>`,
    };
  }
  // Detecta erro em JSON
  try {
    const parsed = JSON.parse(resposta);
    if (parsed && parsed.mensagem && parsed.categoria === "error") {
      return {
        erro: true,
        mensagem: parsed.mensagem,
        html: `<div style='color:#c00;font-size:13px;'>${parsed.mensagem}</div>`,
      };
    }
  } catch {}
  // Não é erro
  return { erro: false, mensagem: "", html: resposta };
}

/**
 * Busca detalhes de uma regulação pelo idp e ids
 * @param {object} param0 
 * @returns {Promise<object>}
 */
async function fetchDetalhesRegulacao({ idp, ids }) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/regulacaoControleSolicitacao/visualiza?reguPK.idp=${idp}&reguPK.ids=${ids}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
      "x-requested-with": "XMLHttpRequest"
    },
    credentials: "include",
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/regulacaoRegulador.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors"
  });
  return await response.json();
}

/**
 * Buscar compromissos do usuário por isenPK e período, com paginação e ordenação
 * @param {Object} options
 * @param {string} options.isenPK - Código isenPK do usuário
 * @param {string} options.dataInicial - Data inicial no formato DD/MM/YYYY
 * @param {string} options.dataFinal - Data final no formato DD/MM/YYYY
 * @param {number} [options.page=1] - Página desejada
 * @param {number} [options.rows=16] - Quantidade de registros por página
 * @param {string} [options.sidx="data"] - Coluna para ordenação
 * @param {string} [options.sord="desc"] - Ordem (asc/desc)
 * @returns {Promise<Object>} Objeto com os compromissos encontrados
 *
 * Exemplo:
 * fetchCompromissosUsuario({
 *   isenPK: '12345-1',
 *   dataInicial: '01/01/2020',
 *   dataFinal: '31/12/2024',
 *   page: 1,
 *   rows: 16,
 *   sidx: 'data',
 *   sord: 'desc'
 * })
 */
async function fetchCompromissosUsuario({
  isenPK,
  dataInicial,
  dataFinal,
  page = 1,
  rows = 15,
  sidx = "data",
  sord = "desc",
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
    method: "GET",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/resumoCompromisso.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar compromissos: " + response.status);
  }
  return response.json();
}

/**
 * Buscar lista de espera do SIGSS por isenPK (fullPK) com paginação e ordenação
 * @param {Object} options
 * @param {string} options.isenPK - Código fullPK do usuário
 * @param {number} [options.page=1] - Página desejada
 * @param {number} [options.rows=15] - Quantidade de registros por página
 * @param {string} [options.sidx="lies.liesGravidade"] - Coluna para ordenação
 * @param {string} [options.sord="desc"] - Ordem (asc/desc)
 * @returns {Promise<Object>} Objeto com total, page, records, rows
 *
 * Exemplo:
 * fetchListaEsperaPorIsenPK({
 *   isenPK: '12345-1',
 *   page: 1,
 *   rows: 15,
 *   sidx: 'lies.liesData',
 *   sord: 'desc'
 * })
 */
async function fetchListaEsperaPorIsenPK({
  isenPK,
  page = 1,
  rows = 15,
  sidx = "lies.liesData",
  sord = "desc",
}) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/listaEspera/listar?filters%5B0%5D=isFiltrarData%3Afalse&filters%5B1%5D=dataInicial%3A&filters%5B2%5D=dataFinal%3A&filters%5B3%5D=limoPK%3A&filters%5B4%5D=liesTipo%3A&filters%5B5%5D=liesSituacao%3ATOD&filters%5B6%5D=isenPK%3A${isenPK}&filters%5B7%5D=apcnId%3A&filters%5B8%5D=prsaPK%3A&filters%5B9%5D=prciPK%3A&filters%5B10%5D=prsaSolicitantePK%3A&filters%5B11%5D=benePK%3A&filters%5B12%5D=deprPK%3A&filters%5B13%5D=clienteId%3A&filters%5B14%5D=prefeituraPK%3A&filters%5B15%5D=isFiltrarDatas%3Afalse&filters%5B16%5D=dataI%3A&filters%5B27%5D=dataF%3A&filters%5B28%5D=tufgId%3A&filters%5B29%5D=tusgId%3A&filters%5B30%5D=isenIsBloqueado%3A&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar lista de espera");
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
        situacao: c[2],
        tipo: c[3],
        gravidade: c[4],
        codigo: c[5],
        nome: c[6],
        idade: c[7],
        dataEntrada: c[8],
        especialidade: c[10]?.replace(/<br\s*\/?>(?!$)/gi, " / "),
      };
    }),
  };
}

/**
 * Utilitário para obter o fullPK do usuário a partir de diferentes estruturas
 * @param {Object} usuario
 * @returns {string|null}
 */
function getUsuarioFullPK(usuario) {
  if (!usuario) return null;
  if (usuario.fullPK) return usuario.fullPK;
  if (usuario.isenPK) return usuario.isenPK;
  if (usuario.idp && usuario.ids) return `${usuario.idp}-${usuario.ids}`;
  return null;
}

/**
 * Buscar regulações do usuário (RegulaçãoRegulador) com filtros customizáveis
 * @param {Object} options
 * @param {Object} options.usuario - Objeto do usuário (deve conter fullPK, isenPK ou idp+ids)
 * @param {Object|Array} [options.filtros] - Filtros adicionais para a busca. Se for array, será usado como ordem e valores exatos.
 * @param {number} [options.page=1] - Página desejada
 * @param {number} [options.rows=13] - Quantidade de registros por página
 * @param {string} [options.sidx="regu.reguDataPrevista"] - Coluna para ordenação
 * @param {string} [options.sord="desc"] - Ordem (asc/desc)
 * @returns {Promise<Object>} Objeto com as regulações encontradas
 *
 * Exemplo:
 * fetchRegulacaoRegulador({ usuario, filtros: [...], page: 1, rows: 13, sidx: "regu.reguDataPrevista", sord: "desc" })
 */
async function fetchRegulacaoRegulador({
  usuario,
  filtros,
  page = 1,
  rows = 15,
  sidx = "regu.reguDataPrevista",
  sord = "desc",
}) {
  const usuarioPK = getUsuarioFullPK(usuario);
  let filterParams = "";
  if (Array.isArray(filtros)) {
    // Se filtros for array, monta exatamente na ordem recebida
    filterParams = filtros
      .map(
        (f, idx) =>
          `filters%5B${idx}%5D=${encodeURIComponent(
            f.key
          )}%3A${encodeURIComponent(f.value)}`
      )
      .join("&");
  } else {
    // Se for objeto, monta normalmente (ordem de Object.entries)
    const defaultFilters = {
      isFiltrarData: "false",
      dataInicial: "",
      dataFinal: "",
      modalidade: "",
      solicitante: "undefined",
      usuarioServico: usuarioPK,
      autorizado: "false",
      pendente: "false",
      devolvido: "false",
      negado: "false",
      emAnalise: "false",
      cancelados: "false",
      cboFiltro: "",
      procedimentoFiltro: "",
      reguGravidade: "",
      reguIsRetorno: "",
      codBarProtocolo: "",
      reguIsAgendadoFiltro: "todos",
    };
    const mergedFilters = { ...defaultFilters, ...(filtros || {}) };
    filterParams = Object.entries(mergedFilters)
      .map(
        ([key, value], idx) =>
          `filters%5B${idx}%5D=${encodeURIComponent(
            key
          )}%3A${encodeURIComponent(value)}`
      )
      .join("&");
  }
  const url = `http://saude.farroupilha.rs.gov.br/sigss/regulacaoRegulador/lista?${filterParams}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/regulacaoRegulador.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar regulações: " + response.status);
  }
  return response.json();
}

/**
 * Buscar agendamentos de exame no SIGSS
 * @param {Object} options
 * @param {string} [options.searchField="isen.isenCod"] - Campo de busca (ex: entfIsen.entfNomeMae)
 * @param {string} [options.isExameTipo="ambos"] - Tipo de exame (isLaboratorial, isNaoLaboratorial, ambos)
 * @param {string} [options.searchString=""] - Texto de busca
 * @param {string} [options.searchStringBuscaUsuServico=""] - Nome do usuário do serviço
 * @param {Object} [options.filters] - Filtros extras (chave: valor)
 * @param {number} [options.page=1] - Página
 * @param {number} [options.rows=30] - Quantidade de registros por página
 * @param {string} [options.sidx="itex.itexDataPrevista"] - Coluna para ordenação
 * @param {string} [options.sord="desc"] - Ordem (asc/desc)
 * @returns {Promise<Object>} Objeto com os agendamentos encontrados
 *
 // Exemplo de uso:
fetchAgendamentosExame({
  searchField: "entfIsen.entfNomeMae",
  isExameTipo: "isLaboratorial",
  searchString: "",
  searchStringBuscaUsuServico: "teste mv",
  filters: [
    { isFiltrarData: false },
    { dataInicial: "" },
    { dataFinal: "" },
    { isFiltrarDataNasc: false },
    { dataNascInicial: "" },
    { dataNascFinal: "" },
    { isFiltrarIdade: false },
    { idadeInicial: "" },
    { idadeFinal: "" }
  ],
  page: 1,
  rows: 30,
  sidx: "itex.itexDataPrevista",
  sord: "desc"
}).then(console.log);
 */
async function fetchAgendamentosExame({
  searchField = "isen.isenCod",
  isExameTipo = "ambos",
  searchString = "",
  searchStringBuscaUsuServico = "",
  filters = {},
  page = 1,
  rows = 15,
  sidx = "itex.itexDataPrevista",
  sord = "desc",
} = {}) {
  // Monta filtros padrão
  const defaultFilters = {
    isFiltrarData: "false",
    dataInicial: "",
    dataFinal: "",
    isFiltrarDataNasc: "false",
    dataNascInicial: "",
    dataNascFinal: "",
    isFiltrarIdade: "false",
    idadeInicial: "",
    idadeFinal: "",
  };
  const allFilters = { ...defaultFilters, ...filters };
  const filtersParams = Object.entries(allFilters)
    .map(([k, v], i) => `filters%5B${i}%5D=${encodeURIComponent(k + ":" + v)}`)
    .join("&");
  const url = `http://saude.farroupilha.rs.gov.br/sigss/agendamentoExame/listar?searchField=${encodeURIComponent(
    searchField
  )}&isExameTipo=${encodeURIComponent(
    isExameTipo
  )}&searchString=${encodeURIComponent(
    searchString
  )}&searchStringBuscaUsuServico=${encodeURIComponent(
    searchStringBuscaUsuServico
  )}&${filtersParams}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/agendamentoExame.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar agendamentos de exame: " + response.status);
  }
  return response.json();
}

/**
 * Buscar requisições laboratoriais (buscaGridReex) do SIGSS
 * @param {Object} options
 * @param {string|number} options.idp - idp do usuário (atcoPK.idp)
 * @param {string|number} options.ids - ids do usuário (atcoPK.ids)
 * @param {number} [options.page=1] - Página desejada
 * @param {number} [options.rows=15] - Quantidade de registros por página
 * @param {string} [options.sidx="reex.reexPK.idp"] - Coluna para ordenação
 * @param {string} [options.sord="desc"] - Ordem (asc/desc)
 * @returns {Promise<Object>} Objeto com as requisições laboratoriais
 *
 * Exemplo:
 * fetchRequisicoesLaboratoriais({ idp: 1581712, ids: 1 })
 */
async function fetchRequisicoesLaboratoriais({
  idp,
  ids,
  page = 1,
  rows = 15,
  sidx = "reex.reexPK.idp",
  sord = "desc",
}) {
  const url = `http://saude.farroupilha.rs.gov.br/sigss/requerimentoExame/buscaGridReex?atcoPK.idp=${encodeURIComponent(
    idp
  )}&atcoPK.ids=${encodeURIComponent(
    ids
  )}&_search=false&nd=${Date.now()}&rows=${rows}&page=${page}&sidx=${encodeURIComponent(
    sidx
  )}&sord=${encodeURIComponent(sord)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
      "content-type": "application/json; charset=iso-8859-1",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "http://saude.farroupilha.rs.gov.br/sigss/atendimentoConsultaAgenda2.jsp",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar requisições laboratoriais: " + response.status);
  }
  return response.json();
}

// Exemplo de uso:
// const params = {
//     searchFieldBusca: "entf.entfNomePai",
//     searchStringBusca: "",
//     searchStringBuscaUsuServico: "cleitom",
//     "filtro[0]": "isFiltrarIdade:false",
//     "filtro[1]": "idadeInicial:",
//     "filtro[2]": "idadeFinal:",
//     "filtro[3]": "isFiltrarDataNasc:false",
//     "filtro[4]": "dataNascInicial:",
//     "filtro[5]": "dataNascFinal:",
//     "filtro[6]": "situacaoCadastral:",
//     "filtro[7]": "isBloqueado:",
//     "filtro[8]": "isenSexo:",
//     "filtro[9]": "status:",
//     "filtro[10]": "enti.entfNomeMaePesquisa:ceni",
//     "filtro[11]": "isen.isenNumCadSusPesquisa:700505913176650",
//     "filtro[12]": "entf.entfDtNasc:",
//     "filtro[13]": "entf.entfCPFPesquisa:92516793049",
//     "filtro[14]": "entf.dataNascimento:",
//     searchStatus: "",
//     _search: "false",
//     nd: "1750305018480",
//     rows: "15",
//     page: "1",
//     sidx: "enti.entiNome",
//     sord: "asc"
// };
// buscarUsuarioServico(params).then(console.log).catch(console.error);
// fetchBuscarUsuarioGenerico('22/10/1975').then(console.log).catch(console.error);
// fetchVisualizaUsuario(107197, 1).then(console.log).catch(console.error);
// fetchFotoUsuario(107197).then(console.log).catch(console.error);
// fetchCompromissosUsuario('isenPK_exemplo', '2023-01-01', '2023-12-31').then(console.log).catch(console.error);
// fetchListaEsperaPorIsenPK('isenPK_exemplo').then(console.log).catch(console.error);
// fetchRegulacaoRegulador({ usuario: { isenPK: '12345-1' }, filtros: { autorizado: 'true' }, page: 1, rows: 13 }).then(console.log).catch(console.error);
// fetchAgendamentosExame({
//   searchStringBuscaUsuServico: 'teste mv',
//   isExameTipo: 'isLaboratorial',
//   page: 1,
//   rows: 30
// }).then(console.log).catch(console.error);
// fetchRequisicoesLaboratoriais({ idp: 1581712, ids: 1, page: 1, rows: 15 }).then(console.log).catch(console.error);
