# Frickbear Editor

Unofficial, fully local save editor for **Frickbears 3 v2.0.0** (`_v2-0-0`).

Everything runs in the browser. Save files are never uploaded anywhere.

---

## Open it

```bash
./start.sh          # serves on http://localhost:8123/
# or
python3 -m http.server 8123

open http://localhost:8123/ in your browser
```

You can also open `index.html` directly, but a local server is recommended so browser storage and fonts behave consistently.

---

## What it edits

| File | Contents |
| --- | --- |
| `savedata_v2-0-0.wario` | Current run: night, difficulty, route, guard, start room, paycheck, run time, deaths, salvages, masks, scraps and upgrades |
| `records_v2-0-0.wario` | Permanent progress: gallery pages, death/salvage records, minigames, tokens, high scores, upgrades, trophies, challenges, guards, skins, stickers, endings, boss records, settings and unlock flags |
| `endlessdata_v2-0-0.txt` | Four Layers Down run: round, lives, guard, inventory, cartridges, consumables, upgrades, Eleanor state and repeat prevention |

Features:

- Load multiple files at once (drag and drop anywhere, or use **Upload**).
- Named entries for all animatronics, upgrades, minigames, trophies and challenges — no guessing array indices.
- Bulk actions: unlock everything, max tokens/scores, complete challenges, complete salvage flags, max stickers, and more.
- Filters and search on large grids.
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`), session restore, and `Ctrl+S` to download.
- Readable settings (graphics/audio/gameplay/keybinds) and key capture.
- Raw JSON tab with validation and formatting.
- Templates to create fresh v2.0.0 run, records or endless files.
- Automatically detects older saves and offers to add missing v2.0.0 fields.

---

## How to use it safely

1. **Close Frickbears 3.** The game may rewrite saves on exit.
2. Back up your save folder:
   `C:\users\<you>\AppData\Local\Frickbears3`
   (on this machine: `~/.wine/drive_c/users/davidg/AppData/Local/Frickbears3/`)
3. Open the editor, upload the `.wario` / `.txt` files.
4. Make your changes.
5. Click **Download** and put the downloaded file back into the same AppData folder, replacing the original.
6. Start the game.

The editor appends the trailing NUL byte the game's `buffer_string` expects. Existing values are kept when loading older saves; nothing is rewritten until you download.

---

## Notes / limitations

- The editor does not add a checksum or signature because the game does not use one; it reads plain JSON via `json_parse`.
- Some values are recalculated by the game (for example completion trophies when visiting Extras). Unlocking a gallery page does not retroactively grant its trophy.
- A few gallery slots (`87–117`, `144–153`, `180–199`) have no descriptions in the game data, so they are shown as `Unknown #<id>`.
- Skins are custom folder indices from the game's `skins` directory; `-1` means default.
- This is a fan tool. Back up first.

---

## Project layout

Game data (`data.js`) was extracted from `data.win` using UndertaleModTool/Underanalyzer, then parsed from the decompiled GML data tables (`AnimatronicData`, `UpgradeData`, `MinigameData`, trophy names, custom-night presets, rooms and phone-call assets).

---

## Credits

- **Frickbears 3** by 4LD. This tool is unofficial and not affiliated with or endorsed by the Frickbears team.
- **Pixel Operator** font by Jayvee Enaguas (CC0).
- **UndertaleModTool / Underanalyzer** for GameMaker bytecode decompilation.
