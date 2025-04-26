import { searchTMDB } from './api.js';

export function setupAutocomplete(inputId, callback) {
    const input = document.getElementById(inputId);  // This should match the 'id' in HTML
    const list = document.createElement('div');
  list.id = 'autocomplete-list';
  input.parentNode.appendChild(list);

  let timeout;

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const query = input.value.trim();
      if (!query) {
        list.innerHTML = '';
        return;
      }

      console.log('Searching for:', query);  // Log the search query
      const results = await searchTMDB(query);
      console.log('Search results:', results);  // Log the results to ensure the API is responding

      if (!results) {
        list.innerHTML = '<div class="autocomplete-item">No results</div>';
        return;
      }

      const items = Array.isArray(results) ? results : [results];
      list.innerHTML = '';

      items.slice(0, 5).forEach(result => {
        const title = result.title || result.name;
        const year = result.release_date?.split('-')[0] || '';
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = `${title} ${year}`;
        div.addEventListener('click', () => {
          input.value = title;
          list.innerHTML = '';
          console.log('Selected:', result);
          callback(result); // Pass result to your game logic
        });
        list.appendChild(div);
      });
    }, 300);
  });
}
