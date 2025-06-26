// Este listener reencaminha a mensagem do scraper para a sidebar ativa
chrome.runtime.onMessage.addListener((message, sender) => {
  // Verifica se a mensagem é do nosso scraper de prontuário
  if (message.type === 'PRONTUARIO_TEXT') {
      // Reenvia a mensagem, que será capturada pela sidebar
      chrome.runtime.sendMessage({
          type: 'PRONTUARIO_TEXT_FORWARD',
          text: message.text,
          tabId: sender.tab.id // Inclui o ID da aba para referência
      });
  }
});

// Listener existente do menu de contexto
chrome.runtime.onInstalled.addListener(() => {
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
