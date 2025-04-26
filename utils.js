// utils.js

export function toTitleCase(str) {
    if (!str || typeof str !== 'string') return "";
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  export function normalizeApostrophes(str) {
    return str.replace(/[\u2018\u2019\u201A\u02BB\u2032\u2035]/g, "'");
  }
  
  export function removeAccents(str) {
    return normalizeApostrophes(str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  }
  