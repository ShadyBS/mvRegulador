/**
 * @file Módulo para gerir o estado centralizado da aplicação.
 */

/**
 * Objeto que contém todo o estado da aplicação.
 * @property {object|null} currentUser - O objeto completo do utilizador atualmente selecionado.
 * @property {Array<string[]>} suggestions - A lista de sugestões de pesquisa.
 * @property {number} selectedSuggestionIndex - O índice da sugestão atualmente destacada.
 * @property {Array<object>} searchHistory - O histórico das últimas pesquisas de utilizadores.
 * @property {object} settings - As configurações da extensão.
 */
export const state = {
  currentUser: null,
  suggestions: [],
  selectedSuggestionIndex: -1,
  searchHistory: [],
  settings: {
    itemsPerPage: 15 // Valor padrão
  }
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
  state.selectedSuggestionIndex = -1;
}

/**
 * Atualiza o índice da sugestão selecionada.
 * @param {number} index - O novo índice.
 */
export function setSelectedSuggestionIndex(index) {
  state.selectedSuggestionIndex = index;
}

/**
 * Atualiza o histórico de pesquisas.
 * @param {Array<object>} history - O novo array de histórico.
 */
export function setSearchHistory(history) {
    state.searchHistory = history;
}

/**
 * Atualiza as configurações da aplicação.
 * @param {object} newSettings - O novo objeto de configurações.
 */
export function setSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
}
