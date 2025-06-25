/**
 * @file Módulo de Gestão de Erros.
 * Centraliza o logging de erros para facilitar a depuração e a futura
 * integração com serviços de monitoramento (como Sentry, GlitchTip, etc.).
 */

/**
 * Formata e exibe um erro na consola de forma padronizada.
 * Em um ambiente de produção, esta função enviaria o erro para um serviço externo.
 * @param {Error} error - O objeto do erro.
 * @param {string} context - O contexto onde o erro ocorreu (ex: nome da função).
 */
export function logError(error, context = 'global') {
    console.error(
      `[mvRegulador Error] Contexto: ${context}\n` +
      `  - Mensagem: ${error.message}\n` +
      `  - Stack:`, error.stack || 'N/A'
    );
    // Futuramente, aqui seria a chamada para o serviço de logging:
    // Sentry.captureException(error, { extra: { context } });
  }
  
  /**
   * Inicializa os gestores de eventos globais para capturar erros não tratados.
   */
  export function initErrorHandler() {
    // Captura erros de script síncronos
    window.onerror = (message, source, lineno, colno, error) => {
      logError(error || new Error(message), `window.onerror @ ${source}:${lineno}`);
      return true; // Previne que o erro apareça na consola como "uncaught"
    };
  
    // Captura rejeições de Promises não tratadas
    window.onunhandledrejection = (event) => {
      logError(event.reason, 'unhandled-promise-rejection');
    };
  
    console.log('Gestor de erros inicializado.');
  }
  