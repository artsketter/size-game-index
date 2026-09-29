# Size Game Index

## Add a game
1. Create `games/<folder-name>/` containing `game.csv` and up to 5 thumbnails.
2. Add `"<folder-name>"` to `games/manifest.json` (a static site cannot list folders itself).

## game.csv
Two columns, one field per row: `field,value`. Use `|` to separate multiple values (tags, links, languages, author tags). Dates: `YYYY-MM-DD`. Checkboxes: `yes` / `no`. Ratings: `art_rating`, `mechanic_rating`, `animation_rating` are 1–5; `size_focus` is 1–3.

Fields: title, original_title, summary, narrative, time_to_complete, tags, development_status, pricing_model, game_engine, art_rating, main_art_style, mechanic_rating, mechanics_description, animation_rating, size_focus, game_links, walkthrough (file name inside the game folder), creator_link, forum_link, authors, author_tags, last_updated, latest_content_update, release_date, languages, recommended, filtered, contains_ai, entry_last_updated, creation_time, thumbnails (optional).

Thumbnails: either name them `thumb1.jpg` … `thumb5.jpg` (.png/.webp also work), or list file names in the `thumbnails` field. The first is the gallery cover.

## Notes
- Entries with `filtered = yes` are hidden unless the visitor ticks “Show entries marked filtered”.
- `entry_last_updated` and `creation_time` are read from the CSV; update them when you edit or add an entry.
- Cookies: `filters` (tag filters) and `played` (played-before list).
- All styling lives in `css/style.css`.
