// api.js

import { removeAccents } from './utils.js';

const API_KEY = '29aa0d9c6ed58d1e0a92248c0f7cbaa9';
const removePunctuation = (str) => {
  return str.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').toLowerCase();
};

// Utility function to handle all the normalization (spaces, hyphens, case sensitivity)
function normalizeForMatch(str) {
  return str
    .replace(/[\s\-]+/g, '')  // Remove spaces and hyphens
    .normalize("NFD") // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()            // Lowercase everything
    .replace(/[^\w\s]/g, '');  // Remove non-alphanumeric characters
    
}


export async function searchTMDB(query, expectedType) {
  const normalizedQuery = normalizeForMatch(query);  // Use normalizeForMatch directly for consistency

  console.log('Searching for:', query);
  console.log('Expected type:', expectedType);

  // First attempt: use /multi search
  const multiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
  let response = await fetch(multiUrl);
  let data = await response.json();

  let results = (data.results || []).filter(result => {
    if (expectedType === 'movie') return result.media_type === 'movie';
    if (expectedType === 'person') return result.media_type === 'person';
    return false;
  });

  // Filter out adult content
  const adultKeywords = ['adult', 'erotic', 'porn', 'xxx'];
  results = results.filter(result => {
    const title = result.title || result.name || '';
    const overview = result.overview || '';
    return !adultKeywords.some(k => 
      title.toLowerCase().includes(k) || overview.toLowerCase().includes(k)
    );
  });

  // Fallback: if no results, try direct search by type
  if (results.length === 0) {
    console.log('No results from /multi, falling back to /search/' + expectedType);
    const fallbackUrl = `https://api.themoviedb.org/3/search/${expectedType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
    response = await fetch(fallbackUrl);
    data = await response.json();

    results = (data.results || []).map(result => ({
      ...result,
      media_type: expectedType // patch in media_type for consistency
    }));

    results = results.filter(result => {
      const title = result.title || result.name || '';
      const overview = result.overview || '';
      return !adultKeywords.some(k =>
        title.toLowerCase().includes(k) || overview.toLowerCase().includes(k)
      );
    });
  }

  if (results.length === 0) {
    console.log('No results found.');
    return null;
  }

  // ✅ Sort by popularity
  results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Exact match: return immediately if found
  const exactMatch = results.find(result => {
    const nameOrTitle = result.name || result.title || '';
    const normalizedNameOrTitle = normalizeForMatch(nameOrTitle);
    return normalizedNameOrTitle === normalizedQuery;
  });

  if (exactMatch) {
    console.log('Exact Match Found:', exactMatch);
    return exactMatch;  // Return the exact match immediately without going into fuzzy matching
  }

  // Log results before fuzzy matching
  console.log('Filtered Results:', results);

  // If we reach here, go for fuzzy matching
  const fuzzyMatch = results.find(result => {
    const nameOrTitle = result.name || result.title || '';

    // Normalize both query and title to handle spaces and case sensitivity
    const normalizedNameOrTitle = normalizeForMatch(nameOrTitle);

    // If both normalized versions of the query and title match exactly
    if (normalizedQuery === normalizedNameOrTitle) {
      return true;
    }

    // Check for partial matches (using regex)
    const regex = new RegExp(normalizedQuery, 'i'); // Case insensitive
    if (regex.test(normalizedNameOrTitle)) {
      return true;
    }

    return false;
  });

  if (fuzzyMatch) {
    console.log('Fuzzy Match Found:', fuzzyMatch);
    return fuzzyMatch;
  }

  console.log('No match found after fuzzy check.');
  return null;
}






export async function getPopularMovieFromActor(personId, usedMovieIds) {
  console.log("Using personId:", personId);
  const url = `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.cast || data.cast.length === 0) return null;

  const availableMovies = data.cast
    .filter(movie => movie.release_date && !usedMovieIds.includes(movie.id))
    .sort((a, b) => {
      const scoreA = b.vote_count * b.vote_average;
      const scoreB = a.vote_count * a.vote_average;
      return scoreA - scoreB;
    });

  return availableMovies[0] || null;
}



export async function getPopularActorFromMovie(movieId, usedIds, index) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.cast || data.cast.length === 0) return null;

  const sorted = data.cast
    .sort((a, b) => b.popularity - a.popularity)
    .filter(actor => !usedIds.has(actor.id));

  return sorted[index] || sorted[sorted.length - 1] || null;
}

export async function isMovieInPersonCredits(personId, movieTitle) {
  const url = `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const normalize = str => str?.toLowerCase().replace(/[^a-z0-9]/g, '');
  const inputNorm = normalize(movieTitle);

  return data.cast?.some(movie =>
    normalize(movie.title || movie.original_title) === inputNorm
  ) || false;
}

export async function isPersonInMovieCredits(movieId, personName) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.cast?.some(p => p.name.toLowerCase() === personName.toLowerCase()) || false;
}
