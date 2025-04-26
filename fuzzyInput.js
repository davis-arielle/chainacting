import { searchTMDB } from './api.js';

export function levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
        Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1].toLowerCase() === a[j - 1].toLowerCase()) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = 1 + Math.min(
                    matrix[i - 1][j],     // deletion
                    matrix[i][j - 1],     // insertion
                    matrix[i - 1][j - 1]  // substitution
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

export function setupFuzzyInput(inputId, getExpectedType) {
    const input = document.getElementById(inputId);
    const suggestionBox = document.createElement('div');
    suggestionBox.id = 'fuzzy-suggestion-box';
    suggestionBox.className = 'suggestion-box'; // Style this in your CSS
    input.parentNode.appendChild(suggestionBox);

    let timeout;
    let currentSuggestions = [];
    let selectedIndex = -1;
    let results; // declare it up here so it's visible in the whole callback
    

    input.addEventListener('input', async () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            const query = input.value.trim();
    
            if (query.length < 1) return;
    
            if (!query) {
                suggestionBox.innerHTML = '';
                return;
            }
    
            const expectedType = getExpectedType(); // Dynamically get expected type
            console.log("Searching for:", query);
            console.log("Expected type:", expectedType);
    
            try {
                // Perform the search
                const results = await searchTMDB(query, expectedType);
    
                // Ensure results is an array and filter out null or undefined items
                const filteredResults = Array.isArray(results) ? results.filter(item => item != null && typeof item === 'object') : [];
                console.log("Filtered Results:", filteredResults);  // Check the filtered results
    
                // Check for exact matches first (title or name comparison)
                const exactMatch = filteredResults.find(item => 
                    (item.title && item.title.toLowerCase() === query.toLowerCase()) || 
                    (item.name && item.name.toLowerCase() === query.toLowerCase())
                );
    
                if (exactMatch) {
                    console.log("Exact match found:", exactMatch);
                    // Immediately render the exact match without filtering further
                    currentSuggestions = [exactMatch]; // Add exact match to suggestions
                    renderSuggestions(currentSuggestions); // Render the exact match immediately
                    return; // Exit early and skip further fuzzy matching
                }
    
                // If no exact match, continue with fuzzy matching
                console.log("Matches before fuzzy matching:", filteredResults); // Log matches before fuzzy search
    
                // Perform fuzzy matching on the filtered results
                const filteredMatches = filteredResults.filter(item => {
                    const name = (item.title || item.name || '').toLowerCase();
                    const distance = levenshtein(name, query.toLowerCase());
    
                    console.log(`Comparing "${name}" to "${query}", distance: ${distance}`); // Debugging line
    
                    return distance <= 2; // Accept if off by 2 characters or fewer
                });
    
                console.log("Matches found:", filteredMatches); // Check matches after fuzzy matching
    
                // If no matches found, do not render
                if (filteredMatches.length > 0) {
                    currentSuggestions = filteredMatches.slice(0, 5); // Limit to top 5
                    renderSuggestions(currentSuggestions); // Render fuzzy matches
                } else {
                    console.log("No results found.");
                    renderSuggestions([]); // Render empty results if no matches found
                }
    
            } catch (error) {
                console.error("Fuzzy search failed:", error);
            }
    
        }, 300);
    });
    
    
    
            

    function renderSuggestions(suggestions) {
        suggestionBox.innerHTML = '';
        selectedIndex = -1;

        suggestions.forEach((item, index) => {
            const title = item.title || item.name;
            const year = item.release_date?.split('-')[0] || '';
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = `${title} ${year}`;
            div.tabIndex = 0;
            div.addEventListener('click', () => {
                input.value = title;
                suggestionBox.innerHTML = '';

                console.log("Selected movie:", item); // Debugging line


                callback(item);
            });
            suggestionBox.appendChild(div);
        });
    }
}
