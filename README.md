# Keyline CG Studio 3.0

A desktop broadcast character generator for Windows and macOS. You build animated scenes in **Layout** mode with full keyframe control, then run them from a **Sequencer** rundown to **two independent output channels**. Each channel can go out as **NDI fill + key** and/or full screen on any display.

It also includes:

- **3D text:** real extruded, beveled, lit 3D text.
- **Adjustable shadows and glows**, text outlines, shapes and masks.
- **Tickers and crawls.**
- **Game clocks and countdowns.**
- **Video with alpha.**
- **Custom fonts.**
- **DataLinq** live data from Google Sheets, CSV, JSON APIs or Excel, with formatting and color rules.
- **RossTalk / HTTP control** for Ross DashBoard and automation.
- **vMix title import.**

## Install

| Platform | File | First launch |
|---|---|---|
| Windows 10/11 x64 | `Keyline-CG-Studio-3.0.0-win-x64-portable.zip`: unzip and run `Keyline CG Studio.exe`. The CI workflow also builds an installer. | SmartScreen: **More info › Run anyway** |
| Mac, Apple Silicon | `Keyline-CG-Studio-3.0.0-arm64.zip` (CI: `.dmg`) | See below |
| Mac, Intel | `Keyline-CG-Studio-3.0.0-x64.zip` (CI: `.dmg`) | See below |

**macOS:** after moving the app to Applications, run this once:

```bash
xattr -cr "/Applications/Keyline CG Studio.app" && codesign --force --deep --sign - "/Applications/Keyline CG Studio.app"
```

CI builds are already ad-hoc signed. For those, right-click › **Open**. Allow **Local Network** access when asked (NDI and RossTalk need it).

**NDI** needs the free **NDI Tools** from ndi.video, which includes the runtime.

## What's in each mode

### Layout (F3): design and animate
- **Objects:**
  - Text, Quad, Image, Clock (time of day or timer).
  - **3D Text**, with depth, bevel, front/side colors, metalness, roughness and light angle.
  - **Ticker**: a crawl, or a roll for credits and lists.
  - **Video**: MP4/MOV, or **WebM with alpha** for transparency.
- **Shadow / glow on every object.** Settings: color, opacity, softness, distance and angle (45° = down-right). Distance 0 with a bright color makes a glow. Text also gets an **outline**.
- **Shapes:** rectangle, pill, ellipse, triangle, diamond, chevron, arrow, parallelogram, tab.
- **Masks:** an object can be clipped to another object's box. Animate the mask for reveals.
- **Keyframes:** Position, Size, Alpha, Scale, Rotation Z, **Rotation X/Y (3D flips)** and Crop.
  - **Auto-key** (`A`), **Key** (`K`).
  - Frame-by-frame with `,` and `.`.
  - Drag keys to retime them; easing per key.
  - **Pause** and **End** markers.
  - Presets (including Flip and Spin) generate editable keys.
- **Material Manager:** built-in colors. **+** saves the selected object's color; Alt-click removes a saved one.
- **Styles:** **+ Save style** captures an object's whole look (font, colors, outline, shadow); clicking a style applies it to another object.

### Sequence (F4): playout
- **Rundown:** each take has a **Channel** (1 or 2), layer, transition and auto-out.
- **Program monitor:** tabs CH 1 / CH 2 (keys `1`/`2`). On-air chips show every channel and layer.
- **Next strip:** under Preview, shows the take that will go next.
- **Template Data:** published fields per take. **DL** links a field to live data.

### Clocks & timers
**Clocks** button. Make named timers (GAME, SHOT, …) that count down or up:
- Start / Stop, Reset, Set, ±1 s.
- Show one with a Clock object in *Countdown / game clock* mode. Format `M:SS.t` shows tenths under a minute.
- Timers stay in sync on every output and can be run from DashBoard.

### DataLinq
Sources:
- **Google Sheet:** share as "Anyone with the link".
- **CSV link.**
- **CSV file.**
- **Pasted CSV.**
- **JSON feed:** URL or file, plus a path to the list, for example `data.games`. Nested fields become `home.score`.
- **Excel `.xlsx`:** file or link, optional sheet name. Values only; a formula Excel never calculated shows blank.

Linking a field:
- **Row:** a number, `Column=Value` to find a row by key, or `*` for the whole column (one item per line, for tickers).
- **Column:** a name, letter or number.
- **Formatting:** case, decimals, thousands separators, prefix/suffix, and fallback text for empty cells.
- **Color rule:** for example "color if > 99 → gold". It changes the text color on air.

### Outputs and SDI
- **NDI:** channel 1, optionally channel 2. Each can send a **Key** source as well: the alpha as a white-on-black picture. Frame processing runs on background threads, so the editor stays responsive at 59.94.
- **Fullscreen:** any display, any channel, **Fill or Key**.
- **SDI fill + key:** use either of these. Native AJA/DeckLink output isn't built in yet.
  1. An NDI→SDI converter that takes the Fill and Key NDI sources.
  2. Two fullscreen outputs (Fill + Key) into HDMI→SDI converters.

### Remote control (Ross DashBoard, automation)
RossTalk listens on TCP **7788**; HTTP API and touch remote on **8088**. In **Output & Control** you can limit access to **this computer only** or to a list of allowed IPs (for example `10.0.0.25, 10.0.1.*`).

| RossTalk | Action |
|---|---|
| `SEQI 1001` / `SEQI 1001:20` | Take item online (on its channel; optional layer) |
| `SEQO 1001` | Take item offline |
| `CLFB 1:20` / `CLFB 2` | Clear channel 1 layer 20 / all of channel 2 |
| `CLRA` | Clear everything |
| `READ 1001`, `NEXT`, `UP`, `DOWN` | Select / take next / move selection |
| `RESUME 1:20` | Continue a layer past its pause point (animate off) |
| `SETDATA 1001:LINE 1:New text` | Set a published field |
| `TIMER GAME:START`, `:STOP`, `:RESET`, `:SET:12:00`, `:ADD:10`, `:SUB:1` | Run clocks |

HTTP endpoints:
- `/api/take/1001`, `/api/takeout/1001`, `/api/clear/20`, `/api/clearall`, `/api/next`
- `/api/timer/GAME/start`, `/api/timer/GAME/set?value=12:00`
- `/api/set/1001?LINE%201=Text`
- `/api/takes`, `/api/state`
- `/api/rosstalk?cmd=…`

**File › Export DashBoard Panel** writes a CustomPanel `.grid` with take/out buttons for the rundown, per-channel/layer clears, and Start/Stop/Reset for each timer.

### vMix titles and fonts
- **File › Import vMix GT Title…** imports `.gtzip`, `.gtxml` and legacy `.xaml` titles. Named fields become published fields.
- **File › Import Font…** adds TTF/OTF/WOFF/WOFF2 fonts. They work in 2D and 3D text and are carried into the outputs and saved projects.

## Projects and media
- **Saved projects:** `.klcg` files are zip packages containing `project.json` plus every image, video and font they use, so they move between machines intact.
- **Media library:** images and video are stored as files, not embedded in the project, which keeps undo and autosave fast. Older projects are converted automatically when opened.
- **Autosave:** goes to the app's profile folder. If the browser-storage copy is lost, the last autosave is recovered at startup.
- **Undo/redo:** `Ctrl/Cmd+Z`, `Ctrl+Y` / `Cmd+Shift+Z`. In a text field it undoes your typing; elsewhere it undoes project changes, exactly once per press.
- **Quitting:** if the editor ever stops responding, closing the window offers **Quit without saving** after 3 seconds.

## Development

```bash
npm install
```

```bash
npm start
```

```bash
npm test
```

```bash
npm run test:e2e
```

- `npm test` runs unit tests: DataLinq, RossTalk/HTTP, and the NDI FFI against a fake libndi.
- `npm run test:e2e` drives the full app on Linux with Xvfb: 47 scenarios covering 3D text, timers, channels, NDI fill+key, media, Excel/JSON, and undo.

```bash
npm run dist:win
```

```bash
npm run dist:mac
```

Run `dist:win` on Windows and `dist:mac` on macOS, or push a `v*` tag so GitHub Actions builds both.

Key files:
- `src/main.js`: windows, menus, outputs, media protocol, control
- `src/ndi.js`, `src/ndi-worker.js`: NDI sender over koffi FFI, one worker thread per source
- `src/media.js`: content-addressed media store, `kl-media://` protocol with range requests, `.klcg` packaging
- `src/control.js`: RossTalk TCP and HTTP API with access control
- `src/renderer/engine.js`: shared renderer (keyframes, shadows, masks, tickers, timers, program bus)
- `src/renderer/three3d.mjs`: 3D text (three.js; loaders vendored in `vendor/three-jsm`)
- `src/renderer/app.js`: editor UI
- `src/renderer/datalinq.js`: CSV, JSON, XLSX, formatting
- `src/renderer/gtimport.js`: vMix titles

Licenses: fonts via Fontsource under the SIL OFL; three.js and opentype.js are MIT. NDI® is a registered trademark of Vizrt NDI AB.
