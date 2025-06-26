/**
 * Este script é injetado na página do prontuário para extrair o seu conteúdo.
 */
window.addEventListener('load', () => {
    // Dá um pequeno tempo extra para garantir que todo o JS dinâmico foi executado
    setTimeout(() => {
      const text = document.body.innerText;
      chrome.runtime.sendMessage({ type: 'PRONTUARIO_TEXT', text: text });
    }, 1000);
  });
  