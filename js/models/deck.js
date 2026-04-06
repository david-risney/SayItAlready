/**
 * Deck data helpers.
 * A deck is a plain object: { id, name, description, icon, background, words }
 * Each word is either a string or { text, tags[] }.
 */

/** Get the display text of a word entry. */
export function wordText(w) {
  return typeof w === 'string' ? w : w.text;
}

/** Get the difficulty level (0-2) of a word entry. Default 0 if untagged. */
export function wordDifficulty(w) {
  if (typeof w === 'string') return 0;
  const tag = w.tags?.find(t => t.startsWith('difficulty:'));
  return tag ? parseInt(tag.split(':')[1], 10) : 0;
}

/** Check whether a deck has any difficulty-tagged words. */
export function hasDifficultyTags(deck) {
  return deck.words.some(w => typeof w === 'object' && w.tags?.some(t => t.startsWith('difficulty:')));
}

/** Filter words to those at or below the given max difficulty. */
export function filterByDifficulty(words, maxDifficulty) {
  return words.filter(w => wordDifficulty(w) <= maxDifficulty);
}

/** Create a new deck object with defaults. */
export function createDeck({ id, name, description = '', icon = '🃏', background = '', words = [] } = {}) {
  return { id, name, description, icon, background, words: [...words] };
}

/** Shuffle an array in place (Fisher-Yates) and return it. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
