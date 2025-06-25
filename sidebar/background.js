chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pesquisar-usuario-mvregulador",
    title: "Pesquisar usuário no mvRegulador",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pesquisar-usuario-mvregulador" && info.selectionText) {
    // Armazena o termo selecionado para ser usado no painel lateral
    chrome.storage.local.set({ termoBuscaMV: info.selectionText });
    // Opcional: abrir o painel lateral automaticamente
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});
