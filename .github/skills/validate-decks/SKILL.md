---
name: validate-decks
description: 'Validate deck JSON files in the packs/ folder. Use when reviewing, auditing, creating, or editing deck pack JSON files. Checks JSON syntax, UTF-8 encoding, schema structure, spelling, word relevance to the deck theme, difficulty tag presence and appropriateness, and duplicate detection.'
argument-hint: 'Optionally specify a deck filename like "animals.json" to validate one deck, or omit to validate all.'
---

# Deck Pack Validation

## When to Use
- Reviewing existing deck packs for quality
- Creating new deck packs
- Editing words or difficulty tags in a deck
- Auditing all packs before a release

## Procedure

For each deck file in `packs/*.json`, run through all validation checks below in order. Report issues grouped by file, with a final summary.

If a specific deck filename is provided, validate only that file. Otherwise validate all `.json` files in `packs/`.

### Step 1: JSON Syntax & Encoding

1. Read the file and verify it is valid JSON (no trailing commas, correct bracket matching, proper quoting).
2. Verify text contains no encoding artifacts — no `�`, no mojibake, no raw escaped unicode that should be literal characters.
3. Check that all string values use standard double quotes (not curly quotes).

### Step 2: Schema Structure

Every deck file MUST have this exact top-level structure:

```json
{
  "id": "string — kebab-case, matches filename without .json",
  "name": "string — display name",
  "description": "string — short tagline",
  "icon": "string — single emoji",
  "background": "string — CSS gradient",
  "words": [...]
}
```

Every entry in the `words` array MUST have:

```json
{
  "text": "string — the word or phrase",
  "tags": ["difficulty:0" | "difficulty:1" | "difficulty:2"]
}
```

Validate:
- `id` matches filename (e.g., `animals.json` → `"id": "animals"`)
- `icon` is exactly one emoji (grapheme cluster)
- `background` is a valid CSS gradient string
- `words` is a non-empty array
- Each word has exactly one `difficulty:N` tag where N is 0, 1, or 2
- No extra or missing fields at any level

### Step 3: Word Count & Balance

- Report total word count and breakdown by difficulty level.
- Flag if any difficulty level has fewer than 15 or more than 25 words.
- Flag if difficulty levels are significantly unbalanced (differ by more than 5).

### Step 4: Duplicate Detection

- Check for exact duplicate `text` values (case-insensitive).
- Check for near-duplicates (e.g., "Biff Tannen" and "Biff" in the same deck).
- Flag any found.

### Step 5: Spelling & Formatting

For each word entry:
- Check spelling of common English words.
- For proper nouns (character names, place names, brand names), verify the canonical capitalization and punctuation (e.g., "Galentine's Day" not "Galentines Day").
- Flag entries that look like sentence fragments or are unusually long (>40 characters) — long entries are harder in a timed party game.

### Step 6: Relevance to Theme

For each word, justify briefly (1 sentence) why it belongs in the deck based on the deck's `name` and `description`. Flag any that:
- Don't clearly relate to the deck's theme
- Are generic terms that could appear in any deck (unless the deck IS generic, like "Animals" or "Food")
- Appear to be from a completely different topic (e.g., "Dog-with-a-Blog" appearing in Parks & Rec)

### Step 7: Difficulty Appropriateness

Evaluate difficulty tags using these guidelines:

| Difficulty | Tag | Criteria |
|---|---|---|
| Easy | `difficulty:0` | Universally known. Most people would recognize this immediately. Iconic, mainstream, top-of-mind. |
| Medium | `difficulty:1` | Known by fans or people with some familiarity. Requires specific but common knowledge. |
| Hard | `difficulty:2` | Deep cuts. Only dedicated fans or experts would know. Obscure references, minor details, or niche knowledge. |

For themed decks (TV shows, movies, games):
- Easy = main characters, catchphrases, the show's premise
- Medium = recurring characters, notable episodes/moments, key locations
- Hard = one-off references, background details, obscure trivia

For category decks (Animals, Food):
- Easy = items any child would know
- Medium = items most adults would recognize but might need a moment
- Hard = items that would stump a typical adult

Flag any word where the difficulty tag seems wrong with a brief justification.

## Output Format

For each file, output:

```
### filename.json — [PASS | N ISSUES]

[If issues found, list each with:]
- **[CHECK NAME]** "entry text": description of issue → suggested fix

[If clean:]
All checks passed. N words (E easy, M medium, H hard).
```

End with a summary:
```
## Summary
- Files reviewed: N
- Clean: N
- Issues found: N total across N files
```
