# Size Game Index

## Adding a new game
1. Create a new folder in `/games/` containing `game.csv` and up to 5 thumbnails.
2. Run `rebuild_manifest.bat` to regenerate the folder manifest.

## game.csv
Two columns, one field per row: `field,value`. Use `|` to separate multiple values (tags, links, languages, author tags). 
Dates are in the format: `YYYY-MM-DD`. 
Checkboxes: `yes` / `no`. 
Ratings: `art_rating`, `mechanic_rating`, `animation_rating` are 1–5; `size_focus` is 1–3.

Currently included fields: title, original_title, summary, narrative, time_to_complete, tags, development_status, pricing_model, game_engine, art_rating, main_art_style, mechanic_rating, mechanics_description, animation_rating, size_focus, game_links, walkthrough (file name inside the game folder), creator_link, forum_link, authors, author_tags, last_updated, latest_content_update, release_date, languages, recommended, filtered, contains_ai, entry_last_updated, creation_time, thumbnails (optional).

Thumbnails: .jpg/.png/.webp work. The first one listed is the gallery thumbnail.

## Notes
- Entries with `filtered = yes` are hidden unless “Show filtered entries” is enabled.
- `entry_last_updated` and `creation_time` are read from the CSV; update them when you edit or add an entry.
- Cookies: `filters` (tag filters) and `played` (played-before list).
- All styling lives in `css/style.css`.
