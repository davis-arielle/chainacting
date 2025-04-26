// game.js

import { toTitleCase, removeAccents } from './utils.js';
import { setupFuzzyInput } from './fuzzyInput.js';
import { levenshtein } from './fuzzyInput.js';

import {
  searchTMDB,
  getPopularMovieFromActor,
  getPopularActorFromMovie,
  isMovieInPersonCredits,
  isPersonInMovieCredits
} from './api.js';

let input; // Declare without defining yet

function updateInputReference() {
  if (expecting === 'person') {
    input = document.getElementById('actor-search-input'); // If expecting an actor, use actor input
  } else if (expecting === 'movie') {
    input = document.getElementById('movie-search-input'); // If expecting a movie, use movie input
  }
}

const button = document.getElementById('submit-btn');
const chainList = document.getElementById('chain-list');
const startActorBtn = document.getElementById('start-actor');
const startMovieBtn = document.getElementById('start-movie');
const actorgameControls = document.getElementById('actor-game-controls');
const moviegameControls = document.getElementById('movie-game-controls');
const startOptions = document.getElementById('start-options');

let chainLength = 0;
let lastTMDBItem = null;
let expecting = null;
let autoResponseCount = 0;
const addedMovieIds = [];
const addedActorIds = [];  // NOT {} — must be an array


const used = {
  autoMovieIds: new Set(),
  autoActorIds: new Set(),
  userActorNames: new Set(),
  userMovieNames: new Set()
};

function removePunctuation(str) {
  return str.replace(/[^\w\s]/gi, '');  // Removes punctuation except for letters and spaces
}

function startActorGame() {
  console.log('Starting Game...'); // Debugging line
  startOptions.style.display = 'none';
  actorgameControls.style.display = 'block';

  updateInputReference(); // Update input reference for actor game

    // Correctly reference the input element for actor game
    const input = document.getElementById('actor-search-input');
    const button = document.getElementById('submit-btn');
    
    // Now you can safely add the event listeners
    button.addEventListener('click', handleSubmit); 
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') button.click();
    });

  // Set up fuzzy input (only after input element is available)
  setupFuzzyInput('actor-search-input', () => expecting);

  // // Get the query dynamically (this can be from input or a fixed query for now)
  // const query = 'n'; // Example query, replace with actual user input if needed
  // console.log('Expecting:', expecting);
  // // Pass 'expecting' directly to the searchTMDB function
  // searchTMDB(query, expecting)
  //   .then(results => {
  //     if (results && results.length > 0) {
  //       console.log('Search results:', results);
  //       // Handle the results (e.g., update the UI)
  //     } else {
  //       console.log('No results found.');
  //     }
  //   })
  //   .catch(error => {
  //     console.error('Error during search:', error);
  //   });
}

function startMovieGame() {
  console.log('Starting Game...'); // Debugging line
  startOptions.style.display = 'none';
  moviegameControls.style.display = 'block';

  updateInputReference(); // Update input reference for actor game

  // Correctly reference the input element for movie game
  const input = document.getElementById('movie-search-input');
  const button = document.getElementById('submit-btn');

  // Now you can safely add the event listeners
  button.addEventListener('click', handleSubmit); 
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') button.click();
  });

  // Set up fuzzy input (only after input element is available)
  setupFuzzyInput('movie-search-input', () => expecting);


}

async function handleSubmit() {
  console.log('handleSubmit was called'); // <-- add this
  const userInput = input.value.trim();
  if (!userInput) return;

  // Search for either actor or movie based on `expecting`
  const result = await searchTMDB(userInput, expecting);
  if (!result) {
    alert("I couldn't find that. Try again.");
    return;
  }

  // Normalize user input and result title
  const normalizedInput = removePunctuation(removeAccents(userInput).toLowerCase().trim());
  const normalizedResult = removePunctuation(removeAccents(result.name || result.title).toLowerCase().trim());

  // Check if the normalized input matches the result (with a more flexible match)
  const distance = levenshtein(normalizedInput, normalizedResult);
  if (distance > 2) {
    alert("Oops, that doesn't match closely enough. Check your spelling.");
    return;
  }
  

  const cleanName = normalizedResult;
  if (expecting === 'person' && used.userActorNames.has(cleanName)) {
    alert("Already used that actor!");
    return;
  }
  if (expecting === 'movie' && used.userMovieNames.has(cleanName)) {
    alert("Already used that movie!");
    return;
  }


  let isValid = true;
  if (lastTMDBItem) {
    // Check if the current input links properly with the last item in the chain
    if (expecting === 'movie' && lastTMDBItem.media_type === 'person') {
      isValid = await isMovieInPersonCredits(lastTMDBItem.id, result.title || result.name);
    } else if (expecting === 'person' && lastTMDBItem.media_type === 'movie') {
      isValid = await isPersonInMovieCredits(lastTMDBItem.id, result.name);
    }
  }

  if (!isValid) {
    alert("That doesn't link! Make sure the actor was in the movie.");
    return;
  }

  // Add the item to the chain
  addToChain(result, expecting);

  if (expecting === 'person') used.userActorNames.add(cleanName);
  else used.userMovieNames.add(cleanName);

  // AI response based on input
  let nextResult = null;

  if (expecting === 'person') {
    const personId = result.id;

    nextResult = await getPopularMovieFromActor(personId, addedMovieIds);
    if (nextResult) {
      used.autoMovieIds.add(nextResult.id);
      addedMovieIds.push(nextResult.id);

      console.log("Movie we're about to return:", nextResult.title, "ID:", nextResult.id);
      console.log("Current addedMovieIds:", addedMovieIds);
      

      appendAuto('movie', nextResult);
      lastTMDBItem = { ...nextResult, media_type: 'movie' };
    }
  } else if (expecting === 'movie') {
    nextResult = await getPopularActorFromMovie(result.id, used.autoActorIds, Math.floor(autoResponseCount / 5));
    if (nextResult) {
      used.autoActorIds.add(nextResult.id);
      appendAuto('person', nextResult);
      lastTMDBItem = { ...nextResult, media_type: 'person' };
      autoResponseCount++;
    }
  }

  document.getElementById('chain-length').textContent = chainLength;
}

function addToChain(result, expecting) {
  if (expecting === 'movie') {
    const movieId = result.id;
    if (addedMovieIds.includes(movieId)) {
      console.log('Duplicate movie, skipping:', result.title);
      return;
    }
    addedMovieIds.push(movieId);

    const posterPath = result.poster_path;
    if (posterPath) {
      // Movie Poster
      const movieImg = document.getElementById('movie-img');
      const movieLabel = document.getElementById('movie-label');

      if (movieImg) {
        movieImg.src = `https://image.tmdb.org/t/p/w500${posterPath}`;
        movieImg.alt = result.title;
        movieImg.style.display = 'block';
        movieLabel.textContent = result.title;
      } else {
        console.error('Movie image element not found.');
      }

    }

  } else if (expecting === 'person') {
    const actorId = result.id;
    if (addedActorIds.includes(actorId)) {
      console.log('Duplicate person, skipping:', result.name);
      return;
    }
    addedActorIds.push(actorId);

    const profilePath = result.profile_path;
    if (profilePath) {
      // Actor Image
      const actorImg = document.getElementById('actor-img');
      const actorLabel = document.getElementById('actor-label');

      if (actorImg) {
        actorImg.src = `https://image.tmdb.org/t/p/w500${profilePath}`;
        actorImg.alt = result.name;
        actorImg.style.display = 'block';
        actorLabel.textContent = result.name;
      } else {
        console.error('Actor image element not found.');
      }

    }
  }



  // Update chain length (only count user inputs)
  const listItems = Array.from(chainList.children);
  const userInputsOnly = listItems.filter((item, index) => index % 2 === 0);
  document.getElementById('chain-length').textContent = userInputsOnly.length;

  // Update the last item for possible future use
  lastTMDBItem = result;

  // Clear the input field
  input.value = '';
}


function appendAuto(type, data) {
  console.log('appendAuto called with:', type, data);  // Log type and data

  // Get the last list item
  let li = chainList.lastElementChild;

  // If there's no last element, we create a new one
  if (!li) {
    li = document.createElement('li');
    chainList.appendChild(li);
  }

  // Set the emoji based on type (person or movie)
  const emoji = type === 'person' ? '👤 ' : '🎬 ';
  const name = toTitleCase(data.name || data.title);  // Ensure proper name formatting
  li.textContent = emoji + name;  // Set the text content

  // Find the image element inside the last li item
  let img = li.querySelector('img');

  // If no image exists, create one
  if (!img) {
    img = document.createElement('img');
    img.style.width = '150px';
    img.style.height = '200px';
    img.style.display = 'inline-block';
    li.appendChild(img);  // Append the new image
  }

  // Set the image source based on whether it's a movie or person
  if (type === 'movie') {
    const posterPath = data.poster_path;
    img.src = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : '';
    img.alt = data.title;
  } else if (type === 'person') {
    const profilePath = data.profile_path;
    img.src = profilePath ? `https://image.tmdb.org/t/p/w500${profilePath}` : '';
    img.alt = data.name;
  }

  // Update the chain length (only counting user inputs)
  chainLength++;
  document.getElementById('chain-length').textContent = chainLength;

  // Update the lastTMDBItem for possible future use
  lastTMDBItem = data;
}












startActorBtn.addEventListener('click', () => {
  console.log('Actor button clicked');
  expecting = 'person';  // Set the expectation for actor
  startActorGame();      // Call the function to start the game
  input.focus();         // Focus the search input field
});

startMovieBtn.addEventListener('click', () => {
  console.log('Start Movie button clicked'); // Check if this is printed when the button is clicked
  expecting = 'movie';
  startMovieGame();
  // Focus on the search input immediately
  input.focus();
});


