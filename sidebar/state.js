/**
 * @file Módulo para gerir o estado centralizado da aplicação.
 * Evita o uso de variáveis globais, tornando o fluxo de dados mais previsível.
 */

/**
 * Objeto que contém todo o estado da aplicação.
 * @property {object|null} currentUser - O objeto completo do utilizador atualmente selecionado.
 * @property {Array<string[]>} suggestions - A lista de sugestões de pesquisa retornada pela API.
 * @property {number} selectedSuggestionIndex - O índice da sugestão atualmente destacada na lista.
 */
export const state = {
    currentUser: null,
    suggestions: [],
    selectedSuggestionIndex: -1,
  };
  
  /**
   * Atualiza o utilizador atualmente selecionado no estado.
   * @param {object|null} newUser - O novo objeto de utilizador.
   */
  export function setCurrentUser(newUser) {
    state.currentUser = newUser;
  }
  
  /**
   * Atualiza a lista de sugestões no estado.
   * @param {Array<string[]>} newSuggestions - O novo array de sugestões.
   */
  export function setSuggestions(newSuggestions) {
    state.suggestions = newSuggestions;
    state.selectedSuggestionIndex = -1; // Reseta o índice ao atualizar as sugestões
  }
  
  /**
   * Atualiza o índice da sugestão selecionada.
   * @param {number} index - O novo índice.
   */
  export function setSelectedSuggestionIndex(index) {
    state.selectedSuggestionIndex = index;
  }
  