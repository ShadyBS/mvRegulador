let usuarioSelecionado = null;
let sugestoes = [];
let indexSelecionado = -1;

document.addEventListener("DOMContentLoaded", function () {
  const inputBusca = document.getElementById("inputBusca");
  const listaSugestoes = document.getElementById("listaSugestoes");
  const resultado = document.getElementById("resultado");
  const cardUsuario = document.getElementById("cardUsuario");

  async function buscarSugestoes(termo) {
    resultado.style.display = "block";
    resultado.textContent = "🔎 Buscando...";
    listaSugestoes.style.display = "none";
    cardUsuario.innerHTML = "";
    usuarioSelecionado = null;
    if (!termo) {
      resultado.textContent = "Digite um termo para buscar.";
      return;
    }
    try {
      const data = await fetchBuscarUsuarioGenerico({ searchString: termo });
      resultado.style.display = "none";
      sugestoes = data || [];
      renderSugestoes();
    } catch (e) {
      resultado.style.display = "block";
      resultado.textContent = "Erro: " + e.message;
    }
  }

  function renderSugestoes() {
    listaSugestoes.innerHTML = "";
    indexSelecionado = -1;
    if (sugestoes.length > 0) {
      sugestoes.forEach((row, idx) => {
        const li = document.createElement("li");
        li.textContent = row[5] + " - " + (row[6] || "") + " - " + row[7];
        li.dataset.idx = idx;
        li.addEventListener("mousedown", function (e) {
          selecionarSugestao(idx);
        });
        listaSugestoes.appendChild(li);
      });
      listaSugestoes.style.display = "block";
    } else {
      listaSugestoes.style.display = "none";
    }
  }



  // Substituir renderObjetoDetalhado por renderObjetoArvore na exibição do card
  async function selecionarSugestao(idx) {
    // Atualiza usuarioSelecionado para garantir acesso padronizado por propriedades
    const sugestao = sugestoes[idx];
    // Extrai idp e ids do array da sugestão
    const idp = sugestao[0];
    const ids = sugestao[1];
    let detalhes = "";
    let fotoHTML = "";
    let compromissosHTML = "";
    let timelineHTML = "";

    try {
      const data = await fetchVisualizaUsuario({
        idp,
        ids,
      });
      
      if (data && data.usuarioServico) {
        // Padroniza usuarioSelecionado com as propriedades desejadas
        usuarioSelecionado = data.usuarioServico
        detalhes = renderObjetoArvore(data.usuarioServico);
        // --- NOVO: Comparar ficha local com CADSUS pelo CPF em sessão separada ---
        const ficha = data.usuarioServico;
        const cpf =
          ficha && ficha.entidadeFisica && ficha.entidadeFisica.entfCPF;
        const comparacaoDiv =
          document.getElementById("comparacaoCadsus") ||
          (() => {
            const div = document.createElement("div");
            div.id = "comparacaoCadsus";
            div.className = "panel";
            // Cria a sessão se não existir
            let sec = document.getElementById("sessao-comparacao-cadsus");
            if (!sec) {
              sec = document.createElement("section");
              sec.id = "sessao-comparacao-cadsus";
              const btn = document.createElement("button");
              btn.className = "accordion";
              btn.type = "button";
              btn.textContent = "Comparação com CADSUS";
              btn.addEventListener("click", function () {
                this.classList.toggle("active");
                comparacaoDiv.classList.toggle("show");
              });
              sec.appendChild(btn);
              sec.appendChild(div);
              // Insere após a sessão de usuário
              const usuarioSec = document.querySelector(".sessao-usuario");
              if (usuarioSec && usuarioSec.nextSibling) {
                usuarioSec.parentNode.insertBefore(sec, usuarioSec.nextSibling);
              } else if (usuarioSec) {
                usuarioSec.parentNode.appendChild(sec);
              } else {
                document.body.appendChild(sec);
              }
            }
            return div;
          })();
        if (cpf) {
          comparacaoDiv.style.display = "block";
          comparacaoDiv.innerHTML =
            '<div style="color:#888;font-size:13px;">🔎 Comparando ficha com CADSUS...</div>';
          try {
            const htmlComparacao = await fetchAndCompareFichaCadsus({
              ficha,
              cpf,
            });
            // Novo: usar parseCadsusComparacaoResponse para padronizar exibição de erro ou sucesso
            const { erro, html } =
              parseCadsusComparacaoResponse(htmlComparacao);
            comparacaoDiv.innerHTML = html;
          } catch (e) {
            comparacaoDiv.innerHTML =
              '<div style="color:#c00;font-size:13px;">Erro ao comparar ficha com CADSUS: ' +
              e.message +
              "</div>";
          }
        } else {
          comparacaoDiv.style.display = "block";
          comparacaoDiv.innerHTML =
            '<div style="color:#888;font-size:13px;">CPF não disponível para comparação com CADSUS.</div>';
        }
        // Busca foto preferencialmente pelo path em entidadeFisica.foto
        let fotoPath = null;
        if (
          data.usuarioServico.entidadeFisica &&
          data.usuarioServico.entidadeFisica.foto
        ) {
          fotoPath = data.usuarioServico.entidadeFisica.foto;
          if (fotoPath.startsWith("/")) {
            fotoPath = "http://saude.farroupilha.rs.gov.br" + fotoPath;
          } else if (fotoPath.startsWith("img/")) {
            fotoPath = "http://saude.farroupilha.rs.gov.br/sigss/" + fotoPath;
          }
        } else if (usuarioSelecionado.fullPK) {
          // fallback: monta URL pelo fullPK exemplo http://saude.farroupilha.rs.gov.br/sigss/arquivo/foto/pessoa/85580-1
          fotoPath = `http://saude.farroupilha.rs.gov.br/sigss/arquivo/foto/pessoa/${usuarioSelecionado.fullPK}`;
        }
        if (fotoPath) {
          let fotoSrc = fotoPath;
          if (fotoPath.startsWith("/")) {
            fotoSrc = "http://saude.farroupilha.rs.gov.br" + fotoPath;
          } else if (fotoPath.startsWith("img/")) {
            fotoSrc = "http://saude.farroupilha.rs.gov.br/sigss/" + fotoPath;
          }
          fotoHTML = `<div class=\"foto-usuario-container\"><img src=\"${fotoSrc}\" alt=\"Foto do usuário\" class=\"foto-usuario\" onerror=\"this.parentNode.innerHTML='<div style=\\'color:#c00;font-size:12px;text-align:center;\\'>Foto não disponível</div>'\" /></div>`;
        }

        // Buscar compromissos do usuário (histórico) com paginação
        let compromissos = null;
        // Função auxiliar para renderizar compromissos com paginação
        async function renderizarCompromissos(page = 1) {
          compromissosHTML =
            '<div style="color:#888;font-size:13px;">Buscando compromissos...</div>';
          setSpinnerSessao("sessao-compromissos", true);
          try {
            // Período padrão: últimos 5 anos até hoje
            const hoje = new Date();
            const dataFinal = hoje.toLocaleDateString("pt-BR");
            const dataInicial = new Date(
              hoje.getFullYear() - 5,
              hoje.getMonth(),
              hoje.getDate()
            ).toLocaleDateString("pt-BR");
            compromissos = await fetchCompromissosUsuario({
              isenPK: usuarioSelecionado.fullPK,
              dataInicial,
              dataFinal,
              page,
            });
            const lista = compromissos.rows || [];
            const totalRegistros = compromissos.records || 0;
            const paginaAtual = compromissos.page || 1;
            const registrosPorPagina = 10; // valor padrão usado na busca
            const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
            if (!lista || lista.length === 0) {
              compromissosHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div><div style='color:#888;font-size:13px;'>Nenhum compromisso encontrado.</div>`;
            } else {
              // Navegação de páginas com botões modernos, alinhados ao header
              let paginacaoHTML = "";
              if (totalPaginas > 1) {
                paginacaoHTML = `
                                <div class='paginacao-lista-espera paginacao-topo'>
                                    <button class='btn-paginacao' ${
                                      paginaAtual === 1 ? "disabled" : ""
                                    } id='btnCompromissosPrev' title='Página anterior'>
                                        <span class="icon-paginacao">⏮️</span>
                                    </button>
                                    <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
                                    <button class='btn-paginacao' ${
                                      paginaAtual === totalPaginas
                                        ? "disabled"
                                        : ""
                                    } id='btnCompromissosNext' title='Próxima página'>
                                        <span class="icon-paginacao">⏭️</span>
                                    </button>
                                </div>`;
              }
              let tabelaHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div>
                            <div class='header-tabela-lista-espera'>
                                ${paginacaoHTML}
                            </div>
                            <table class='tabela-padrao'><thead><tr><th>Data</th><th>Hora</th><th>Unidade</th><th>Profissional</th><th>Procedimento</th><th>Faltou?</th></tr></thead><tbody>`;
              // Removida ordenação local: exibe na ordem original da API
              lista.forEach((row) => {
                const c = row.cell;
                tabelaHTML += `<tr><td>${c[2]}</td><td>${c[3]}</td><td>${
                  c[4]
                }</td><td>${c[5]}</td><td>${c[6]}</td><td>${c[10].replace(
                  /<[^>]+>/g,
                  ""
                )}</td></tr>`;
              });
              tabelaHTML += "</tbody></table>";
              compromissosHTML = tabelaHTML;
            }
            // Atualiza apenas a tabela de compromissos
            const compromissosDiv =
              document.getElementById("compromissosTabela") ||
              (() => {
                const div = document.createElement("div");
                div.id = "compromissosTabela";
                cardUsuario.appendChild(div);
                return div;
              })();
            compromissosDiv.innerHTML = compromissosHTML;
            // Listeners dos botões de paginação
            if (totalPaginas > 1) {
              if (paginaAtual > 1) {
                setTimeout(() => {
                  document.getElementById("btnCompromissosPrev").onclick = () =>
                    renderizarCompromissos(paginaAtual - 1);
                }, 0);
              }
              if (paginaAtual < totalPaginas) {
                setTimeout(() => {
                  document.getElementById("btnCompromissosNext").onclick = () =>
                    renderizarCompromissos(paginaAtual + 1);
                }, 0);
              }
            }
          } catch (e) {
            const compromissosDiv =
              document.getElementById("compromissosTabela") ||
              (() => {
                const div = document.createElement("div");
                div.id = "compromissosTabela";
                cardUsuario.appendChild(div);
                return div;
              })();
            compromissosDiv.innerHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div><div style='color:#c00;font-size:13px;'>Erro ao buscar compromissos.</div>`;
          } finally {
            setSpinnerSessao("sessao-compromissos", false);
          }
        }
        if (usuarioSelecionado.fullPK) {
          // Cria/limpa divs para compromissos
          let compromissosDiv = document.getElementById("compromissosTabela");
          if (!compromissosDiv) {
            compromissosDiv = document.createElement("div");
            compromissosDiv.id = "compromissosTabela";
            cardUsuario.appendChild(compromissosDiv);
          }
          compromissosDiv.innerHTML = "";
          await renderizarCompromissos(1);
        }
        // --- NOVO: Buscar e exibir lista de espera do usuário com paginação ---

        // Função auxiliar para renderizar a lista de espera com paginação
        async function renderizarListaEspera(page = 1) {
          setSpinnerSessao("sessao-lista-espera", true);
          const listaEsperaDiv = document.getElementById("listaEsperaUsuario");
          if (!listaEsperaDiv) return;
          // Não limpa o painel, só mostra spinner no header
          try {
            const registrosPorPagina = 15; // igual ao padrão SIGSS
            const resultado = await fetchListaEsperaPorIsenPK({
              isenPK: usuarioSelecionado.fullPK,
              page,
              rows: registrosPorPagina
            });
            const lista = resultado.rows;
            const totalRegistros = resultado.records;
            const paginaAtual = resultado.page;
            const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
            if (!lista || lista.length === 0) {
              listaEsperaDiv.innerHTML =
                '<div style="color:#888;font-size:13px;">Nenhuma entrada na lista de espera.</div>';
              return;
            }
            // Navegação de páginas com botões modernos, alinhados ao header
            let paginacaoHTML = "";
            if (totalPaginas > 1) {
              paginacaoHTML = `
                            <div class='paginacao-lista-espera paginacao-topo'>
                                <button class='btn-paginacao' ${
                                  paginaAtual === 1 ? "disabled" : ""
                                } id='btnListaEsperaPrev' title='Página anterior'>
                                    <span class="icon-paginacao">⏮️</span>
                                </button>
                                <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
                                <button class='btn-paginacao' ${
                                  paginaAtual === totalPaginas ? "disabled" : ""
                                } id='btnListaEsperaNext' title='Próxima página'>
                                    <span class="icon-paginacao">⏭️</span>
                                </button>
                            </div>`;
            }
            // Removida ordenação local: exibe na ordem original da API
            let tabelaHTML = `<div class=\"compromissos-titulo\">Lista de Espera SIGSS</div>
        <div class='header-tabela-lista-espera'>
            ${paginacaoHTML}
        </div>
        <table class=\"tabela-padrao\">\n<thead>\n<tr>\n<th>Situação</th>\n<th>Tipo</th>\n<th>Gravidade</th>\n<th>Data Entrada</th>\n<th>Procedimento</th>\n<th>Origem</th>\n<th>Ações</th>\n</tr>\n</thead>\n<tbody>\n${lista
                  .map((item) => {
                    const { procedimento, origem } = extrairProcedimentoOrigem(
                      item.especialidade
                    );
                    // Adiciona botão de imprimir apenas para exames (tipo EXA)
                    let btnImprimir = '';
                    if (item.tipo === 'EXA' && item.id && Array.isArray(item.cell)) {
                      const idp = item.cell[0];
                      const ids = item.cell[1];
                      btnImprimir = `<button class='btn-imprimir-exame' title='Imprimir requisição' data-idp='${idp}' data-ids='${ids}'>🖨️</button>`;
                    }
                    return `\n<tr>\n<td>${item.situacao}</td>\n<td>${item.tipo}</td>\n<td>${item.gravidade}</td>\n<td>${item.dataEntrada}</td>\n<td>${procedimento}</td>\n<td>${origem}</td>\n<td>${btnImprimir}</td>\n</tr>\n`;
                  })
                  .join("")}
            </tbody>
        </table>`;
            listaEsperaDiv.innerHTML = tabelaHTML;
            // Listeners dos botões de paginação (atualizam só a lista de espera)
            if (totalPaginas > 1) {
              if (paginaAtual > 1) {
                document.getElementById("btnListaEsperaPrev").onclick = () =>
                  renderizarListaEspera(paginaAtual - 1);
              }
              if (paginaAtual < totalPaginas) {
                document.getElementById("btnListaEsperaNext").onclick = () =>
                  renderizarListaEspera(paginaAtual + 1);
              }
            }
            // Listener para botões de imprimir
            listaEsperaDiv.querySelectorAll('.btn-imprimir-exame').forEach(btn => {
              btn.addEventListener('click', function () {
                const idp = this.getAttribute('data-idp');
                const ids = this.getAttribute('data-ids');
                imprimirRequisicaoExameNaoLab(idp, ids);
              });
            });
          } catch (err) {
            listaEsperaDiv.innerHTML = `<div style=\"color:#c00;font-size:13px;\">Erro ao buscar lista de espera: ${
              err && err.message ? err.message : err
            }</div>`;
            console.error("[mvRegulador] Erro ao buscar lista de espera:", err);
          } finally {
            setSpinnerSessao("sessao-lista-espera", false);
          }
        }
        
        if (usuarioSelecionado.fullPK) {
          renderizarListaEspera(1, usuarioSelecionado.fullPK);
        } else {
          const listaEsperaDiv = document.getElementById("listaEsperaUsuario");
          if (listaEsperaDiv) {
            listaEsperaDiv.innerHTML =
              '<div style="color:#888;font-size:13px;">ISENPK não encontrado para este usuário.</div>';
          }
        }
        
        // --- FIM NOVO ---
        // Chama renderizarRegulacoes para exibir regulações do usuário
        if (usuarioSelecionado.fullPK) {
          renderizarRegulacoes({ fullPK: usuarioSelecionado.fullPK }, 1);
        } else {
          const regulacaoDiv =
            document.getElementById("regulacaoTabela") ||
            (() => {
              const div = document.createElement("div");
              div.id = "regulacaoTabela";
              const sec = document.getElementById("sessao-regulacao");
              if (sec) sec.appendChild(div);
              return div;
            })();
          regulacaoDiv.innerHTML =
            '<div style="color:#c00;font-size:13px;">Identificador do usuário não encontrado para buscar regulações.</div>';
        }

        // Buscar e exibir agendamentos de exame do usuário ao selecionar
        if (typeof buscarAgendamentosExame === "function") {
          buscarAgendamentosExame(1);
        }
      } else {
        detalhes = '<div style="color:#c00">Detalhes não encontrados.</div>';
      }
    } catch (e) {
      detalhes = `<div style="color:#c00">Erro ao buscar detalhes: ${e.message}</div>`;
    }
 
    cardUsuario.innerHTML = `<div class=\"card-usuario\" style=\"padding:0;overflow-x:auto;\">${fotoHTML}${detalhes}</div>`;

    listaSugestoes.style.display = "none";
    resultado.style.display = "none";
    // Adiciona listeners para expandir/recolher
    cardUsuario.querySelectorAll(".tree-toggle").forEach((span) => {
      span.addEventListener("click", function () {
        const target = cardUsuario.querySelector("#" + span.dataset.target);
        if (target.style.display === "none") {
          target.style.display = "block";
          span.textContent = "▼";
        } else {
          target.style.display = "none";
          span.textContent = "▶";
        }
      });
    });
    
  }

  inputBusca.addEventListener("keydown", function (e) {
    if (listaSugestoes.style.display === "block") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (indexSelecionado < sugestoes.length - 1) {
          indexSelecionado++;
          atualizarSelecaoVisual();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (indexSelecionado > 0) {
          indexSelecionado--;
          atualizarSelecaoVisual();
        }
      } else if (e.key === "Enter") {
        if (indexSelecionado >= 0) {
          selecionarSugestao(indexSelecionado);
        } else {
          // Buscar sugestões ao pressionar Enter
          const termo = inputBusca.value.trim();
          if (termo.length >= 3) {
            buscarSugestoes(termo);
          }
        }
      } else if (e.key === "Escape") {
        listaSugestoes.style.display = "none";
      }
    } else if (e.key === "Enter") {
      // Buscar sugestões ao pressionar Enter
      const termo = inputBusca.value.trim();
      if (termo.length >= 3) {
        buscarSugestoes(termo);
      }
    }
  });

  function atualizarSelecaoVisual() {
    const lis = listaSugestoes.querySelectorAll("li");
    lis.forEach((li) => li.classList.remove("selected"));
    if (indexSelecionado >= 0 && lis[indexSelecionado]) {
      lis[indexSelecionado].classList.add("selected");
      lis[indexSelecionado].scrollIntoView({ block: "nearest" });
    }
  }

  document.addEventListener("click", function (e) {
    if (!listaSugestoes.contains(e.target) && e.target !== inputBusca) {
      listaSugestoes.style.display = "none";
    }
  });

  // Accordion para sessões
  document.querySelectorAll(".accordion").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.classList.toggle("active");
      const panel = this.nextElementSibling;
      if (panel.classList.contains("show")) {
        panel.classList.remove("show");
      } else {
        panel.classList.add("show");
      }
    });
  });
  // Abre todas as sessões por padrão
  document
    .querySelectorAll(".panel")
    .forEach((panel) => panel.classList.add("show"));
});

  // Função para renderizar objeto como árvore expansível
  function renderObjetoArvore(obj, prefixo = "") {
    let html = '<ul style="list-style:none;padding-left:16px;">';
    for (const chave in obj) {
      const valor = obj[chave];
      if (typeof valor === "object" && valor !== null) {
        const id = "tree_" + prefixo.replace(/\./g, "_") + chave;
        html += `<li><span class="tree-toggle" data-target="${id}" style="cursor:pointer;color:#0078d7;">▶</span> <strong>${chave}</strong>: <span style="color:#888;">{...}</span><div id="${id}" style="display:none;">${renderObjetoArvore(
          valor,
          prefixo + chave + "."
        )}</div></li>`;
      } else {
        html += `<li><strong>${chave}</strong>: <span style="color:#222;">${valor}</span></li>`;
      }
    }
    html += "</ul>";
    return html;
  }
// Recebe informações do content script (SIGSS)
window.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SIGSS_USER_INFO") {
    // Exemplo: preencher automaticamente o campo de busca com CPF, CNS ou isenpk
    if (event.data.cpf) {
      inputBusca.value = event.data.cpf;
    } else if (event.data.cns) {
      inputBusca.value = event.data.cns;
    } else if (event.data.isenpk) {
      inputBusca.value = event.data.isenpk;
    }
    // Você pode armazenar em variáveis globais ou usar como quiser
  }
});

// Ao abrir o painel lateral, preencher inputBusca com termo salvo pelo menu de contexto e já buscar
chrome.storage &&
  chrome.storage.local.get("termoBuscaMV", function (data) {
    if (data && data.termoBuscaMV) {
      inputBusca.value = data.termoBuscaMV;
      // Limpa o termo para não repetir em aberturas futuras
      chrome.storage.local.remove("termoBuscaMV");
      // Dispara a busca automaticamente
      if (data.termoBuscaMV.length >= 3) {
        buscarSugestoes(data.termoBuscaMV);
      }
    }
  });

// Detecta mudanças no storage para buscar termo mesmo com painel já aberto
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (
      area === "local" &&
      changes.termoBuscaMV &&
      changes.termoBuscaMV.newValue
    ) {
      inputBusca.value = changes.termoBuscaMV.newValue;
      // Dispara a busca automaticamente
      if (changes.termoBuscaMV.newValue.length >= 3) {
        buscarSugestoes(changes.termoBuscaMV.newValue);
      }
      // Limpa o termo para não repetir
      chrome.storage.local.remove("termoBuscaMV");
    }
  });
}

// Função auxiliar para separar procedimento e origem
function extrairProcedimentoOrigem(especialidade) {
  if (!especialidade) return { procedimento: "", origem: "" };
  const partes = especialidade.split("; /");
  return {
    procedimento: partes[0] ? partes[0].replace(/^\s+|\s+$/g, "") : "",
    origem: partes[1]
      ? partes[1].replace(/^\s*Origem:\s*/i, "").replace(/^\s+|\s+$/g, "")
      : "",
  };
}

// Remover uso global de compromissos para timeline
// A timeline deve ser renderizada a partir da lista local, usando a função renderizarTimeline(listaCompromissos)

// Função para mostrar/hide spinner no header de qualquer sessão
function setSpinnerSessao(sessaoClass, ativo) {
  const header = document.querySelector(`.${sessaoClass} .accordion`);
  if (!header) return;
  let spinner = header.querySelector(".spinner-sessao");
  if (ativo) {
    if (!spinner) {
      spinner = document.createElement("span");
      spinner.className = "spinner-sessao";
      spinner.innerHTML = '<span class="lds-dual-ring"></span>';
      header.appendChild(spinner);
    }
  } else {
    if (spinner) spinner.remove();
  }
}

// Exemplo de uso do spinner genérico em todas as sessões
// Lista de Espera
async function renderizarListaEspera(page = 1) {
  setSpinnerSessao("sessao-lista-espera", true);
  const listaEsperaDiv = document.getElementById("listaEsperaUsuario");
  if (!listaEsperaDiv) return;

  try {
    const resultado = await fetchListaEsperaPorIsenPK({
      isenPK: usuarioSelecionado.fullPK,
      page,
    });
    const lista = resultado.rows;
    const totalRegistros = resultado.records;
    const paginaAtual = resultado.page;
    const registrosPorPagina = 10;
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;
    if (!lista || lista.length === 0) {
      listaEsperaDiv.innerHTML =
        '<div style="color:#888;font-size:13px;">Nenhuma entrada na lista de espera.</div>';
      return;
    }
    // Navegação de páginas com botões modernos, alinhados ao header
    let paginacaoHTML = "";
    if (totalPaginas > 1) {
      paginacaoHTML = `
            <div class='paginacao-lista-espera paginacao-topo'>
                <button class='btn-paginacao' ${
                  paginaAtual === 1 ? "disabled" : ""
                } id='btnListaEsperaPrev' title='Página anterior'>
                    <span class="icon-paginacao">⏮️</span>
                </button>
                <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
                <button class='btn-paginacao' ${
                  paginaAtual === totalPaginas ? "disabled" : ""
                } id='btnListaEsperaNext' title='Próxima página'>
                    <span class="icon-paginacao">⏭️</span>
                </button>
            </div>`;
    }
    // Removida ordenação local: exibe na ordem original da API
    let tabelaHTML = `<div class=\"compromissos-titulo\">Lista de Espera SIGSS</div>
        <div class='header-tabela-lista-espera'>
            ${paginacaoHTML}
        </div>
        <table class=\"tabela-padrao\">\n<thead>\n<tr>\n<th>Situação</th>\n<th>Tipo</th>\n<th>Gravidade</th>\n<th>Data Entrada</th>\n<th>Procedimento</th>\n<th>Origem</th>\n<th>Ações</th>\n</tr>\n</thead>\n<tbody>\n${lista
                  .map((item) => {
                    const { procedimento, origem } = extrairProcedimentoOrigem(
                      item.especialidade
                    );
                    // Adiciona botão de imprimir apenas para exames (tipo EXA)
                    let btnImprimir = '';
                    if (item.tipo === 'EXA' && item.id && Array.isArray(item.cell)) {
                      const idp = item.cell[0];
                      const ids = item.cell[1];
                      btnImprimir = `<button class='btn-imprimir-exame' title='Imprimir requisição' data-idp='${idp}' data-ids='${ids}'>🖨️</button>`;
                    }
                    return `\n<tr>\n<td>${item.situacao}</td>\n<td>${item.tipo}</td>\n<td>${item.gravidade}</td>\n<td>${item.dataEntrada}</td>\n<td>${procedimento}</td>\n<td>${origem}</td>\n<td>${btnImprimir}</td>\n</tr>\n`;
                  })
                  .join("")}
            </tbody>
        </table>`;
    listaEsperaDiv.innerHTML = tabelaHTML;
    // Listeners dos botões de paginação (atualizam só a lista de espera)
    if (totalPaginas > 1) {
      if (paginaAtual > 1) {
        document.getElementById("btnListaEsperaPrev").onclick = () =>
          renderizarListaEspera(paginaAtual - 1);
      }
      if (paginaAtual < totalPaginas) {
        document.getElementById("btnListaEsperaNext").onclick = () =>
          renderizarListaEspera(paginaAtual + 1);
      }
    }
    // Listener para botões de imprimir
    listaEsperaDiv.querySelectorAll('.btn-imprimir-exame').forEach(btn => {
      btn.addEventListener('click', function () {
        const idp = this.getAttribute('data-idp');
        const ids = this.getAttribute('data-ids');
        imprimirRequisicaoExameNaoLab(idp, ids);
      });
    });
  } catch (err) {
    listaEsperaDiv.innerHTML = `<div style=\"color:#c00;font-size:13px;\">Erro ao buscar lista de espera: ${
      err && err.message ? err.message : err
    }</div>`;
    console.error("[mvRegulador] Erro ao buscar lista de espera:", err);
  } finally {
    setSpinnerSessao("sessao-lista-espera", false);
  }
}

// Compromissos
async function renderizarCompromissos(page = 1) {
  setSpinnerSessao("sessao-compromissos", true);
  const compromissosDiv = document.getElementById("compromissosTabela");
  try {
    // Período padrão: últimos 5 anos até hoje
    const hoje = new Date();
    const dataFinal = hoje.toLocaleDateString("pt-BR");
    const dataInicial = new Date(
      hoje.getFullYear() - 5,
      hoje.getMonth(),
      hoje.getDate()
    ).toLocaleDateString("pt-BR");
    const resultado = await fetchCompromissosUsuario({
      isenPK: usuarioSelecionado.fullPK,
      dataInicial,
      dataFinal,
      page,
    });
    const lista = resultado.rows || [];
    const totalRegistros = resultado.records || 0;
    const paginaAtual = resultado.page || 1;
    const registrosPorPagina = 10; // valor padrão usado na busca
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;
    if (!lista || lista.length === 0) {
      compromissosHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div><div style='color:#888;font-size:13px;'>Nenhum compromisso encontrado.</div>`;
    } else {
      // Navegação de páginas com botões modernos, alinhados ao header
      let paginacaoHTML = "";
      if (totalPaginas > 1) {
        paginacaoHTML = `
                <div class='paginacao-lista-espera paginacao-topo'>
                    <button class='btn-paginacao' ${
                      paginaAtual === 1 ? "disabled" : ""
                    } id='btnCompromissosPrev' title='Página anterior'>
                        <span class="icon-paginacao">⏮️</span>
                    </button>
                    <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
                    <button class='btn-paginacao' ${
                      paginaAtual === totalPaginas ? "disabled" : ""
                    } id='btnCompromissosNext' title='Próxima página'>
                        <span class="icon-paginacao">⏭️</span>
                    </button>
                </div>`;
      }
      let tabelaHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div>
            <div class='header-tabela-lista-espera'>
                ${paginacaoHTML}
            </div>
            <table class='tabela-padrao'><thead><tr><th>Data</th><th>Hora</th><th>Unidade</th><th>Profissional</th><th>Procedimento</th><th>Faltou?</th></tr></thead><tbody>`;
      // Removida ordenação local: exibe na ordem original da API
      lista.forEach((row) => {
        const c = row.cell;
        tabelaHTML += `<tr><td>${c[2]}</td><td>${c[3]}</td><td>${
          c[4]
        }</td><td>${c[5]}</td><td>${c[6]}</td><td>${c[10].replace(
          /<[^>]+>/g,
          ""
        )}</td></tr>`;
      });
      tabelaHTML += "</tbody></table>";
      compromissosHTML = tabelaHTML;
    }
    // Atualiza apenas a tabela de compromissos
    compromissosDiv.innerHTML = compromissosHTML;
    // Listeners dos botões de paginação
    if (totalPaginas > 1) {
      if (paginaAtual > 1) {
        setTimeout(() => {
          document.getElementById("btnCompromissosPrev").onclick = () =>
            renderizarCompromissos(paginaAtual - 1);
        }, 0);
      }
      if (paginaAtual < totalPaginas) {
        setTimeout(() => {
          document.getElementById("btnCompromissosNext").onclick = () =>
            renderizarCompromissos(paginaAtual + 1);
        }, 0);
      }
    }
  } catch (e) {
    if (compromissosDiv)
      compromissosDiv.innerHTML = `<div class='compromissos-titulo'>Histórico de Compromissos</div><div style='color:#c00;font-size:13px;'>Erro ao buscar compromissos.</div>`;
  } finally {
    setSpinnerSessao("sessao-compromissos", false);
  }
}

// Regulacoes
// Removido filtros dinâmicos de regulações
async function renderizarRegulacoes(usuario, page = 1) {
  setSpinnerSessao("sessao-regulacao", true);
  const regulacaoDiv =
    document.getElementById("regulacaoTabela") ||
    (() => {
      const div = document.createElement("div");
      div.id = "regulacaoTabela";
      const sec = document.getElementById("sessao-regulacao");
      if (sec) sec.appendChild(div);
      return div;
    })();
  regulacaoDiv.innerHTML =
    '<div style="color:#888;font-size:13px;">Buscando regulações...</div>';
  try {
    const resultado = await fetchRegulacaoRegulador({ usuario, page });
    const lista = resultado.rows || [];
    const totalRegistros = resultado.records || 0;
    const paginaAtual = resultado.page || 1;
    const registrosPorPagina = 10;
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;
    if (!lista || lista.length === 0) {
      regulacaoDiv.innerHTML = `<div class='compromissos-titulo'>Regulações</div><div style='color:#888;font-size:13px;'>Nenhuma regulação encontrada.</div>`;
    } else {
      let paginacaoHTML = "";
      if (totalPaginas > 1) {
        paginacaoHTML = `
                <div class='paginacao-lista-espera paginacao-topo'>
                    <button class='btn-paginacao' ${
                      paginaAtual === 1 ? "disabled" : ""
                    } id='btnRegulacaoPrev' title='Página anterior'>
                        <span class="icon-paginacao">⏮️</span>
                    </button>
                    <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
                    <button class='btn-paginacao' ${
                      paginaAtual === totalPaginas ? "disabled" : ""
                    } id='btnRegulacaoNext' title='Próxima página'>
                        <span class="icon-paginacao">⏭️</span>
                    </button>
                </div>`;
      }
      let tabelaHTML = `<div class='compromissos-titulo'>Regulações</div>
            <div class='header-tabela-lista-espera'>${paginacaoHTML}</div>
            <table class='tabela-padrao'><thead><tr>
              <th>ID</th><th>Tipo</th><th>Prioridade</th><th>Data</th><th>Status</th><th>Procedimento/CID</th><th>Profissional</th><th>Unidade</th><th>Ações</th>
            </tr></thead><tbody>`;
      lista.forEach((row) => {
        const c = row.cell;
        // Status colorido
        const status = (c[5] || "").replace(/<[^>]+>/g, "");
        let statusColor = "#aaa";
        if (status.includes("AUTORIZADO")) statusColor = "#278B77";
        else if (status.includes("CANCELADA")) statusColor = "#E6E600";
        else if (status.includes("NEGADO")) statusColor = "#F90000";
        else if (status.includes("DEVOLVIDO")) statusColor = "#f5ad14";
        // Destaca CID se houver
        let procedimentoCid = c[6] || "";
        const cidMatch = procedimentoCid.match(/CID:\s*([A-Z0-9\-\.]+)/i);
        let cidHtml = procedimentoCid;
        if (cidMatch) {
          cidHtml = procedimentoCid.replace(
            cidMatch[0],
            `<span title='CID' style='color:#0078d7;font-weight:bold;'>${cidMatch[0]}</span>`
          );
        }
        // Botão de detalhes
        const btnDetalhes = `<button class='btn-detalhes-regulacao' data-idp='${c[0]}' data-ids='${c[1]}' title='Ver detalhes'>🔎</button>`;
        tabelaHTML += `<tr>
                    <td>${c[0]}</td>
                    <td>${c[2]}</td>
                    <td>${c[3]}</td>
                    <td>${c[4]}</td>
                    <td style="color:${statusColor};font-weight:bold;" title="${status}">${status}</td>
                    <td>${cidHtml}</td>
                    <td>${c[7]}</td>
                    <td>${c[8]}</td>
                    <td>${btnDetalhes}</td>
                </tr>`;
      });
      tabelaHTML += "</tbody></table>";
      regulacaoDiv.innerHTML = tabelaHTML;
      // Listeners dos botões de paginação
      if (totalPaginas > 1) {
        setTimeout(() => {
          if (paginaAtual > 1)
            document.getElementById("btnRegulacaoPrev").onclick = () =>
              renderizarRegulacoes(usuario, paginaAtual - 1);
          if (paginaAtual < totalPaginas)
            document.getElementById("btnRegulacaoNext").onclick = () =>
              renderizarRegulacoes(usuario, paginaAtual + 1);
        }, 0);
      }
      // Listener para detalhes
      regulacaoDiv
        .querySelectorAll(".btn-detalhes-regulacao")
        .forEach((btn) => {
          btn.addEventListener("click", async function () {
            const idp = this.getAttribute("data-idp");
            const ids = this.getAttribute("data-ids");
            try {
              const data = await fetchDetalhesRegulacao({ idp, ids });
              // Exibe detalhes em um modal simples
              const modal = document.createElement("div");
              modal.style.position = "fixed";
              modal.style.top = "0";
              modal.style.left = "0";
              modal.style.width = "100vw";
              modal.style.height = "100vh";
              modal.style.background = "rgba(0,0,0,0.4)";
              modal.style.zIndex = "9999";
              modal.innerHTML = `
              <div style="background:#fff;max-width:600px;margin:40px auto;padding:24px 18px;border-radius:8px;box-shadow:0 2px 16px #0002;position:relative;">
                <button style="position:absolute;top:8px;right:12px;font-size:18px;background:none;border:none;cursor:pointer;" title="Fechar" id="fecharModalRegulacao">✖️</button>
                <h2 style="font-size:1.2em;margin-bottom:12px;">Detalhes da Regulação</h2>
                <div style="max-height:60vh;overflow:auto;font-size:13px;">
                  ${renderObjetoArvore(data.regulacao)}
                </div>
              </div>
            `;
              document.body.appendChild(modal);
              document.getElementById("fecharModalRegulacao").onclick = () =>
                modal.remove();
              modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
              };
              // Expansão de árvore
              modal.querySelectorAll(".tree-toggle").forEach((span) => {
                span.addEventListener("click", function () {
                  const target = modal.querySelector("#" + span.dataset.target);
                  if (target.style.display === "none") {
                    target.style.display = "block";
                    span.textContent = "▼";
                  } else {
                    target.style.display = "none";
                    span.textContent = "▶";
                  }
                });
              });
            } catch (e) {
              alert("Erro ao buscar detalhes da regulação: " + e.message);
            }
          });
        });
    }
  } catch (e) {
    regulacaoDiv.innerHTML = `<div class='compromissos-titulo'>Regulações</div><div style='color:#c00;font-size:13px;'>Erro ao buscar regulações: ${e.message}</div>`;
  } finally {
    setSpinnerSessao("sessao-regulacao", false);
  }
}

// ================= AGENDAMENTOS DE EXAME =====================
// Remove o formulário e busca manual, busca é automática ao selecionar usuário
function buscarAgendamentosExame(page = 1) {
  const tabelaDiv = document.getElementById("agendamentosExameTabela");
  tabelaDiv.innerHTML = '<div style="color:#888;font-size:13px;">Buscando agendamentos...</div>';
  setSpinnerSessao("sessao-agendamentos-exame", true);
  if (!usuarioSelecionado || !usuarioSelecionado.isenCod) {
    tabelaDiv.innerHTML = '<div style="color:#c00;font-size:13px;">Selecione um usuário para buscar exames.</div>';
    setSpinnerSessao("sessao-agendamentos-exame", false);
    return;
  }
  // Busca sempre pelo isenCod do usuário selecionado
  const params = {
    searchField: "isen.isenCod",
    isExameTipo: "ambos", // valor padrão
    searchString: usuarioSelecionado.isenCod,
    page,
    rows: 10,
    sidx: "itex.itexDataPrevista",
    sord: "desc"
  };
  fetchAgendamentosExame(params)
    .then(resultado => renderizarTabelaAgendamentos(resultado, page))
    .catch(e => {
      tabelaDiv.innerHTML = `<div style='color:#c00;font-size:13px;'>Erro ao buscar agendamentos: ${e.message}</div>`;
    })
    .finally(() => setSpinnerSessao("sessao-agendamentos-exame", false));
}

async function imprimirGuiaExame(idp, ids) {
  try {
    const params = new URLSearchParams();
    params.append("filters[0]", `examIdp:${idp}`);
    params.append("filters[1]", `examIds:${ids}`);
    const response = await fetch(
      "http://saude.farroupilha.rs.gov.br/sigss/itemExame/imprimirGuia",
      {
        method: "POST",
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
        },
        body: params.toString(),
        credentials: "include",
        referrer:
          "http://saude.farroupilha.rs.gov.br/sigss/agendamentoExame.jsp",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      }
    );
    const data = await response.json();
    if (data && data.report) {
      window.open("http://saude.farroupilha.rs.gov.br" + data.report, "_blank");
    } else {
      alert("Não foi possível gerar a guia.");
    }
  } catch (e) {
    alert("Erro ao gerar guia: " + e.message);
  }
}

function renderizarTabelaAgendamentos(resultado, page) {
  const tabelaDiv = document.getElementById("agendamentosExameTabela");
  const lista = resultado.rows || [];
  const totalRegistros = resultado.records || 0;
  const paginaAtual = resultado.page || 1;
  const registrosPorPagina = 10;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina) || 1;
  if (!lista.length) {
    tabelaDiv.innerHTML = `<div style='color:#888;font-size:13px;'>Nenhum agendamento encontrado.</div>`;
    return;
  }
  let paginacaoHTML = "";
  if (totalPaginas > 1) {
    paginacaoHTML = `
      <div class='paginacao-lista-espera paginacao-topo'>
        <button class='btn-paginacao' ${
          paginaAtual === 1 ? "disabled" : ""
        } id='btnAgExamePrev' title='Página anterior'>⏮️</button>
        <span class='paginacao-info'>Página <b>${paginaAtual}</b> de <b>${totalPaginas}</b></span>
        <button class='btn-paginacao' ${
          paginaAtual === totalPaginas ? "disabled" : ""
        } id='btnAgExameNext' title='Próxima página'>⏭️</button>
      </div>`;
  }
  let tabelaHTML = `<div class='compromissos-titulo'>Agendamentos de Exame</div>
    <div class='header-tabela-lista-espera'>${paginacaoHTML}</div>
    <table class='tabela-padrao'><thead><tr>
      <th>Data Prevista</th><th>Paciente</th><th>CPF</th><th>Exame</th><th>Unidade</th><th>Status</th><th>Ações</th>
    </tr></thead><tbody>`;
  lista.forEach((row) => {
    const c = row.cell;
    // Adiciona botão de imprimir usando os IDs do exame
    const btnImprimir = `<button class='btn-imprimir-ag-exame' title='Imprimir guia' data-idp='${c[0]}' data-ids='${c[1]}'>🖨️</button>`;
    tabelaHTML += `<tr>
      <td>${c[2]}</td>
      <td>${c[3]}</td>
      <td>${c[4]}</td>
      <td>${c[5]}</td>
      <td>${c[6]}</td>
      <td>${c[7]}</td>
      <td>${btnImprimir}</td>
    </tr>`;
  });
  tabelaHTML += "</tbody></table>";
  tabelaDiv.innerHTML = tabelaHTML;
  // Listeners de paginação
  if (totalPaginas > 1) {
    setTimeout(() => {
      if (paginaAtual > 1)
        document.getElementById("btnAgExamePrev").onclick = () =>
          buscarAgendamentosExame(paginaAtual - 1);
      if (paginaAtual < totalPaginas)
        document.getElementById("btnAgExameNext").onclick = () =>
          buscarAgendamentosExame(paginaAtual + 1);
    }, 0);
  }
  // Listener para botões de imprimir guia
  tabelaDiv.querySelectorAll(".btn-imprimir-ag-exame").forEach((btn) => {
    btn.addEventListener("click", function () {
      const idp = this.getAttribute("data-idp");
      const ids = this.getAttribute("data-ids");
      imprimirGuiaExame(idp, ids);
    });
  });
}
// Remove o formulário de busca manual de exames do DOM ao carregar
window.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formAgendamentoExame");
  if (form) form.style.display = "none";
});

// Função para imprimir requisição de exame não laboratorial
async function imprimirRequisicaoExameNaoLab(idp, ids) {
  try {
    const params = new URLSearchParams();
    params.append('lies.liesPK.idp', idp);
    params.append('lies.liesPK.ids', ids);
    const response = await fetch('http://saude.farroupilha.rs.gov.br/sigss/requerimentoExame/imprimirRequerimentoExameNaoLabByLies', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7,pt-PT;q=0.6',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: params.toString(),
      credentials: 'include',
      referrer: 'http://saude.farroupilha.rs.gov.br/sigss/listaEspera.jsp',
      referrerPolicy: 'strict-origin-when-cross-origin',
      mode: 'cors'
    });
    const data = await response.json();
    if (data && data.report) {
      window.open('http://saude.farroupilha.rs.gov.br' + data.report, '_blank');
    } else {
      alert('Não foi possível gerar a requisição.');
    }
  } catch (e) {
    alert('Erro ao gerar requisição: ' + e.message);
  }
}
