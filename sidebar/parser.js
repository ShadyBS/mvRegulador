/**
 * @file Módulo de análise de texto para extrair códigos clínicos.
 */

/**
 * Extrai todos os códigos CID-10 e CIAP-2 de um bloco de texto.
 * @param {string} text - O texto completo do prontuário.
 * @returns {Set<string>} Um Set com todos os códigos únicos encontrados.
 */
export function extractCodes(text) {
  const codes = new Set();
  if (!text) return codes;

  // Regex para CID-10: Procura por "CID - " seguido por um código como A01, F41.1, etc.
  const cidRegex = /CID\s*-\s*([A-Z][0-9]{2}(?:\.[0-9]{1,2})?)/g;
  
  // Regex para CIAP-2: Procura por "CIAP - " seguido por um código como A01, P80, etc.
  const ciapRegex = /CIAP\s*-\s*([A-Z][0-9]{2})/g;
  
  let match;
  while ((match = cidRegex.exec(text)) !== null) {
    codes.add(match[1].trim());
  }
  while ((match = ciapRegex.exec(text)) !== null) {
    codes.add(match[1].trim());
  }

  return codes;
}
