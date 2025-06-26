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
      fetch(ciap2Url),
    ]);

    if (!cid10Response.ok || !ciap2Response.ok) {
      throw new Error('Não foi possível descarregar os dados de terminologia.');
    }

    const cid10Data = await cid10Response.json();
    const ciap2Data = await ciap2Response.json();

    const normalizeText = (text) => {
      if (!text) return '';
      return text
        .normalize('NFD') // Separa acentos das letras
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .toLowerCase();
    };

    const normalizeCode = (code) =>
      code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const formatCodes = (data, system) => {
      if (data.compose && data.compose.include) {
        return data.compose.include
          .flatMap((i) => i.concept || [])
          .map((c) => ({
            code: c.code,
            display: c.display,
            system: system,
            normalized_code: normalizeCode(c.code),
            normalized_display: normalizeText(c.display), // Adiciona descrição normalizada
          }));
      }
      return [];
    };

    const clinicalCodes = {
      cid10: formatCodes(cid10Data, 'CID-10'),
      ciap2: formatCodes(ciap2Data, 'CIAP-2'),
    };

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
    const codesData = result.clinicalCodes;

    if (!codesData || !codesData.cid10 || codesData.cid10.length === 0) {
      console.log('Dados de terminologia não encontrados. A iniciar descarga...');
      await updateLocalTerminologyData();
      const updatedResult = await chrome.storage.local.get('clinicalCodes');
      performSearch(query, updatedResult.clinicalCodes, sendResponse);
    } else {
      performSearch(query, codesData, sendResponse);
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function performSearch(query, clinicalCodes, sendResponse) {
  const { cid10 = [], ciap2 = [] } = clinicalCodes || {};
  const allCodes = [...cid10, ...ciap2];

  const normalizeQuery = (text) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const normalizedQuery = normalizeQuery(query);
  const normalizedCodeQuery = query.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const filteredResults = allCodes.filter(
    (item) =>
      item.normalized_code.includes(normalizedCodeQuery) ||
      item.normalized_display.includes(normalizedQuery)
  );

  sendResponse({ success: true, data: filteredResults });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_CLINICAL_CODES') {
    handleClinicalCodeSearch(message.query, sendResponse);
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  updateLocalTerminologyData();
  chrome.contextMenus.create({
    id: 'pesquisar-usuario-mvregulador',
    title: 'Pesquisar usuário no mvRegulador',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'pesquisar-usuario-mvregulador' && info.selectionText) {
    chrome.storage.local.set({ termoBuscaMV: info.selectionText });
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});
