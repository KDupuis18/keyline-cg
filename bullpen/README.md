# Bullpen CG

Baseball broadcast graphics. Score the game pitch by pitch in a browser console, and the graphics follow the game automatically. Bring them into your switcher as browser sources (vMix, OBS, TriCaster, Wirecast, CasparCG).

It runs on any Mac, Windows or Linux machine with Node.js 18 or newer. Anyone on the network can open the console from a laptop or tablet.

## Run it

```bash
cd bullpen
npm install
npm start
```

Open `http://localhost:8180/` for the operator console. The server also prints a LAN address so a second operator can join from another machine. Set `PORT=` to use a different port.

## Outputs

Add these as 1920×1080 browser sources:

| Address | What it is |
|---|---|
| `/output` | Program fill on a transparent background |
| `/output?key=1` | Program key: white graphics on black, for a separate fill + key into NDI or SDI |
| `/output?bg=00ff00` | Program on a solid color, for chroma keying |
| `/output?only=bug` | One layer only: `bug`, `lower`, `full`, `flash`, `ticker` (comma-separated list) |
| `/output?preview=1` | What's loaded in preview |

## What it does

**Scoring (Game tab, F1)**
- **Pitches:** Ball, called strike, swinging strike, foul. Fouls with two strikes don't add a strike. Ball four is a walk and strike three is a strikeout, recorded automatically.
- **Results:** 1B, 2B, 3B, HR, out, K, DP, SAC, BB, IBB, HBP, E, FC and runner out. Runners advance by the usual defaults. Click a base or use the run buttons to fix anything unusual.
- **Innings:** Three outs ends the half-inning. The bug shows `MID 3` or `END 3` until the next pitch.
- **Tracked for the game:**
  - Linescore by inning, plus R / H / E.
  - Each batter's line, for example `2-for-3, HR, 2 RBI`.
  - Each pitcher's line: IP, H, R, BB, K, pitch and strike counts.
- **Batting order:** follows each team separately. Click a name to set who's up.
- **Pitching changes:** one dropdown.
- **Undo / redo:** `Ctrl+Z` steps back through every scoring action.

**Graphics**
- **Scorebug:** teams, score, inning, outs, runners, count and pitch count. It's always live, and a score that changes flashes. Top left, top right or bottom left.
- **Lower thirds:**
  - Batter: season AVG / HR / RBI / OPS plus today's line.
  - Pitcher: W-L / ERA / K / WHIP plus today's line.
  - Matchup.
  - Pitch count.
  - Due up: the next three hitters.
  - Linescore.
  - Custom two-line lower third.
- **Full screen:** starting lineup for either team, and a scoreboard with the full linescore.
- **Flash under the bug:** pitch speed and type, or a message (pitching change, replay review, rain delay, …).
- **Ticker:** a crawl along the bottom. Lower thirds move up to clear it.
- **Taking graphics:** click a graphic to load it in preview, then press **TAKE** (Space). Double-click takes it straight to air.
- **Auto-clear:** lower thirds can clear themselves after N seconds.
- **Auto batter lower third:** can show automatically when each new batter comes up.

**Teams (F2)**
- Set city, name, abbreviation, record, colors and logo for each team.
- Edit the roster inline.
- Set the batting order and positions.
- Import a roster from CSV.
  - Columns, any order: `num, first, last` (or `name`), `pos, bats, throws, avg, hr, rbi, ops, w, l, era, so, whip`.
  - The first nine non-pitchers become the batting order.

**Settings (F3)**
- Game title and venue.
- Colors and bug position.
- Save or open a game file.
- New game (keeps rosters).
- Output addresses and the control API.

The game autosaves to `data/autosave.json` and comes back after a restart.

## Control API

Plain HTTP GETs for Stream Deck / Bitfocus Companion, for example:

```
/api/do/pitch?kind=ball            /api/do/result?kind=hr
/api/do/take?gfx=batter            /api/do/take?gfx=linescore&secs=10
/api/do/take?gfx=pitchspeed&mph=97&pitch=Slider&secs=6
/api/do/take                       (take what's in preview)
/api/do/clear?slot=lower           /api/do/bug     /api/do/undo
```

`GET /api/state` returns the full state as JSON. `POST /api/action` takes the same actions as a JSON body. `GET /events` is the live Server-Sent Events stream.

## Keyboard

| Key | Action |
|---|---|
| `B` | Ball |
| `S` | Called strike |
| `W` | Swinging strike |
| `F` | Foul |
| `1` `2` `3` `H` | Hits |
| `O` | Out |
| `K` | Strikeout |
| `D` | Double play |
| `Space` | Take preview |
| `Esc` | Clear lower third |
| `G` | Scorebug on/off |
| `Q` | Preview batter |
| `P` | Preview pitcher |
| `M` | Preview matchup |
| `L` | Preview linescore |

## Limits

- Runner movement uses defaults. The operator corrects unusual plays, such as a runner taking an extra base, with the base and run buttons.
- Runs scored are tracked for the batter on a home run only. Runners aren't tracked individually.
- There's no built-in NDI/SDI output. Use the switcher's browser source, which can send NDI, or take the fill and key pages to SDI through your switcher.
- There are no logins. Run it on a trusted production network.

## Tests

```bash
npm test          # scoring engine unit tests
npm run test:e2e  # drives the console and outputs in Chromium (needs Playwright), saves screenshots to test/shots/
```
