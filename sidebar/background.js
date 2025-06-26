/**
 * Descarrega e processa os dados de terminologia (CID-10, CIAP-2)
 * e guarda-os no armazenamento local da extensão.
 */
async function updateLocalTerminologyData() {
  console.log('A verificar e atualizar os dados de terminologia...');
  try {
    const cid10Url = 'https://terminologia.saude.gov.br/fhir/ValueSet-BRCID10.json';
    const ciap2Url = 'https://terminologia.saude.gov.br/fhir/ValueSet-BRCIAP2.json';

    const [cid10Response, ciap2Response] = await Promise.all([
      fetch(cid10Url),
      fetch(ciap2Url)
    ]);

    if (!cid10Response.ok || !ciap2Response.ok) {
      throw new Error('Não foi possível descarregar os dados de terminologia.');
    }

    const cid10Data = await cid10Response.json();
    const ciap2Data = await ciap2Response.json();

    // Extrai e formata os códigos para uma estrutura mais simples
    const formatCodes = (data, system) => {
      if (data.compose && data.compose.include) {
        return data.compose.include.flatMap(i => i.concept || []).map(c => ({
          code: c.code,
          display: c.display,
          system: system
        }));
      }
      return [];
    };

    const clinicalCodes = {
      cid10: formatCodes(cid10Data, 'CID-10'),
      ciap2: formatCodes(ciap2Data, 'CIAP-2')
    };

    // Guarda os dados processados no armazenamento local
    await chrome.storage.local.set({ clinicalCodes });
    console.log('Dados de terminologia atualizados com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar os dados de terminologia:', error);
  }
}

/**
 * Lida com a pesquisa de códigos clínicos a partir dos dados locais.
 */
async function handleClinicalCodeSearch(query, sendResponse) {
  try {
    const result = await chrome.storage.local.get('clinicalCodes');
    const { cid10 = [], ciap2 = [] } = result.clinicalCodes || {};
    
    if (cid10.length === 0 && ciap2.length === 0) {
        // Se os dados ainda não foram carregados, tenta carregar agora
        await updateLocalTerminologyData();
        // Tenta a busca novamente após o carregamento
        const updatedResult = await chrome.storage.local.get('clinicalCodes');
        const { cid10: newCid10 = [], ciap2: newCiap2 = [] } = updatedResult.clinicalCodes || {};
        performSearch(query, newCid10, newCiap2, sendResponse);
    } else {
        performSearch(query, cid10, ciap2, sendResponse);
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function performSearch(query, cid10, ciap2, sendResponse) {
    const lowerCaseQuery = query.toLowerCase();
    const allCodes = [...cid10, ...ciap2];

    const filteredResults = allCodes.filter(item => 
        item.code.toLowerCase().includes(lowerCaseQuery) ||
        item.display.toLowerCase().includes(lowerCaseQuery)
    );

    sendResponse({ success: true, data: filteredResults });
}


/**
 * Listener principal de mensagens da extensão.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_CLINICAL_CODES') {
    handleClinicalCodeSearch(message.query, sendResponse);
    return true; // Indica que a resposta será assíncrona
  }

  if (message.type === 'PRONTUARIO_TEXT') {
    chrome.runtime.sendMessage({
        type: 'PRONTUARIO_TEXT_FORWARD',
        text: message.text,
        tabId: sender.tab.id
    });
  }
});

// Listener existente do menu de contexto
chrome.runtime.onInstalled.addListener(() => {
  // Descarrega os dados na primeira instalação
  updateLocalTerminologyData();
  
  chrome.contextMenus.create({
    id: "pesquisar-usuario-mvregulador",
    title: "Pesquisar usuário no mvRegulador",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pesquisar-usuario-mvregulador" && info.selectionText) {
    chrome.storage.local.set({ termoBuscaMV: info.selectionText });
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});
