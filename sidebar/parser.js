/**
 * @file Módulo de análise de texto para extrair códigos clínicos.
 */

/**
 * Extrai todos os códigos CID-10 e CIAP-2 de um bloco de texto.
 * As expressões regulares foram melhoradas para serem mais flexíveis, encontrar
 * códigos em diferentes formatos e para normalizar os resultados.
 * @param {string} text - O texto completo do prontuário.
 * @returns {Set<string>} Um Set com todos os códigos únicos encontrados, incluindo as suas variações.
 */
export function extractCodes(text) {
  const codes = new Set();
  if (!text) return codes;

  // Função auxiliar para adicionar o código e a sua forma normalizada ao Set.
  // Ex: Se encontrar "Z000", adiciona tanto "Z000" como "Z00.0".
  const addNormalizedCode = (code) => {
    if (!code) return;
    const cleanedCode = code.trim().toUpperCase().replace(/\.$/, ''); // Remove ponto final se houver

    // Adiciona o código encontrado
    codes.add(cleanedCode);

    // Se o código tem o formato XNNN (ex: Z000), adiciona a versão XNN.N (ex: Z00.0)
    if (/^[A-Z][0-9]{3}$/.test(cleanedCode)) {
      const dottedVersion = `${cleanedCode.slice(0, 3)}.${cleanedCode.slice(3)}`;
      codes.add(dottedVersion);
    }
    // Se o código tem o formato XNN.N (ex: Z00.0), adiciona a versão XNNN (ex: Z000)
    else if (/^[A-Z][0-9]{2}\.[0-9]$/.test(cleanedCode)) {
        const nonDottedVersion = cleanedCode.replace('.', '');
        codes.add(nonDottedVersion);
    }
  };

  // Regex 1: Procura por códigos CID com prefixos comuns (ex: "CID - I10", "Diagnóstico Z00.0").
  // Inclui o non-breaking space (\u00A0) para maior compatibilidade.
  const prefixedCidRegex = /(?:CID-?10?|Diagn[oó]stico|HD)[\s\u00A0]*[:\-]?[\s\u00A0]*([A-Z][0-9]{2,3}(?:\.[0-9]{1,2})?)/gi;
  
  // Regex 2: Procura por códigos que podem estar sozinhos no texto, sem prefixo imediato.
  // Usa \b (word boundary) para garantir que é um código isolado e não parte de outra palavra.
  const standaloneCidRegex = /\b([A-Z][0-9]{2,3}(?:\.[0-9]{1,2})?)\b/g;

  // Regex 3: Procura por códigos CIAP2 com prefixo, que é mais específico.
  const ciapRegex = /\bCIAP-?2?[\s\u00A0]*[:\-]?[\s\u00A0]*([A-Z][0-9]{2})\b/gi;
  
  let match;
  
  // Itera e adiciona os códigos encontrados por cada regex.
  // O Set lida automaticamente com quaisquer duplicatas.
  while ((match = prefixedCidRegex.exec(text)) !== null) {
    if (match[1]) addNormalizedCode(match[1]);
  }
  
  while ((match = standaloneCidRegex.exec(text)) !== null) {
    // Adiciona uma verificação para garantir que estamos a capturar algo que se parece com um CID
    // e não uma abreviatura qualquer de 3 letras.
    if (match[1] && /^[A-Z][0-9]{2}/.test(match[1])) {
       addNormalizedCode(match[1]);
    }
  }

  while ((match = ciapRegex.exec(text)) !== null) {
    if (match[1]) addNormalizedCode(match[1]);
  }

  return codes;
}
