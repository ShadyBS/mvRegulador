/**
 * Este script é injetado na página do prontuário para extrair o seu conteúdo.
 * A sua única função é esperar a página carregar e enviar o texto de volta.
 */
window.addEventListener('load', () => {
  // Dá um tempo extra para garantir que o JS dinâmico da página foi executado.
  setTimeout(() => {
    try {
      const text = document.body.innerText;
      // Envia uma mensagem para o background script com o texto extraído.
      chrome.runtime.sendMessage({ type: 'PRONTUARIO_TEXT', text: text });
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'PRONTUARIO_ERROR', error: e.message });
    }
  }, 1500); // Espera 1.5 segundos.
});
