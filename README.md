<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="TypogNotes logo" />

# TypogNotes

**Write better, every day.**

A Windows desktop app for taking notes on ruled paper, sorting them into folders
and finding them again instantly. Everything stays on your computer: no account, no cloud.

[![Download for Windows](https://img.shields.io/github/v/release/zSimone35/TypogNotes?label=Download%20for%20Windows&style=for-the-badge&color=855133)](https://github.com/zSimone35/TypogNotes/releases/latest)

![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-2024-000000?logo=rust)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite)
![MIT License](https://img.shields.io/badge/license-MIT-green)

<img src="assets/screenshots/scrivania.png" alt="The Desk (Scrivania): a note on ruled paper with a table, a checklist and the compact toolbar" width="900" />

</div>

> **Note:** the application interface is in Italian. Italian UI names are given in parentheses where they first appear.

> ✨ **New in [1.1.0](https://github.com/zSimone35/TypogNotes/releases/tag/v1.1.0): drawing notes and tables.** Handwrite with the mouse or a tablet pen, insert tables into your notes, and enjoy a more compact toolbar.

## Table of contents

- [Features](#features)
- [Gallery](#gallery)
- [Installation](#installation)
- [How to use it](#how-to-use-it)
- [Your data](#your-data)
- [Development](#development)
- [Project structure](#project-structure)
- [Feedback](#feedback)
- [License](#license)

## Features

**Writing**
- Ruled paper with adjustable line spacing: headings, lists, checklists, code and images always stay aligned to the lines.
- H1–H3 headings with **collapsible sections**: the arrow to the right of a heading hides the content below it.
- Full formatting: font per selection, size, bold, italic, underline, strikethrough, alignment.
- **10×8 palette** for text and highlighter, custom colors and **recent colors for each note**.
- **Tables**: pick rows × columns from a grid, right-click a cell to add or delete rows and columns, merge or split cells, toggle the header row. Columns can be resized by dragging.
- Code blocks with syntax highlighting (14 languages) and quick copy.
- **Images** (PNG, JPEG, WebP, GIF, BMP) from a button or with Ctrl+V, in 5 layouts: inline, wrap text, break text, behind or in front of the text.
- Horizontal dividers from 1 to 8 px thick (right-click the button or the line).
- Offline spell checking in Italian, English, French, Spanish and German, with a personal dictionary; it ignores code blocks.
- Find and replace (Ctrl+F) and a note outline generated from the headings.

**Drawing notes**
- A note you write by hand, with the mouse, a graphics tablet pen or a finger.
- Pen whose stroke width follows the tablet pressure, highlighter, stroke eraser, colors and 4 sizes.
- Blank, ruled or squared page that grows as you write; undo and redo (Ctrl+Z / Ctrl+Y).
- While a pen is in use, touches from the resting hand are ignored.
- Strokes are saved as vectors: sharp at any size and exported as SVG.

**Organization**
- **Dashboard** (*Bacheca*) to browse folders and notes: search, filters, sorting, grid or list view, drag a note onto a folder to move it.
- **Tabs** for the notes in the current folder at the top of the Desk (*Scrivania*), reorderable by dragging or with the arrow keys.
- Pinned notes, notes flagged as "to fix", multi-select to move or delete.
- **Archive** (*Archivio*) and **Trash** (*Cestino*) as pages of their own: open a note read-only, restore it or delete it permanently.

**Look and feel**
- Material Design 3 interface with light and dark themes.
- 16 paper colors, with dedicated names in the dark theme.
- Focus mode, collapsible sidebar, compact toolbar: all tools on at most two rows, with labels turning into icons as the window gets narrower.

**Export**
- Markdown, HTML and PDF; tables and drawings included.

## Gallery

| Dashboard | Dark theme |
|---|---|
| <img src="assets/screenshots/bacheca.png" alt="Dashboard with folders, text notes and drawing notes" /> | <img src="assets/screenshots/scrivania-scura.png" alt="The Desk in the dark theme, with a table" /> |
| **Drawing note** | **Drawing note, dark theme** |
| <img src="assets/screenshots/disegno.png" alt="A drawing note on squared paper: handwriting, a diagram with arrows and highlighter" /> | <img src="assets/screenshots/disegno-scuro.png" alt="The same drawing note in the dark theme, with light ink" /> |
| **Table actions** | **Paper colors** |
| <img src="assets/screenshots/tabella.png" alt="Right-click menu on a table cell with row and column actions" /> | <img src="assets/screenshots/fogli.png" alt="Menu of the 16 paper colors" /> |
| **Text and highlighter palette** | **Trash** |
| <img src="assets/screenshots/palette.png" alt="Text color palette" /> | <img src="assets/screenshots/cestino-scuro.png" alt="Trash page with notes shown as cards" /> |

## Installation

1. Download `TypogNotes_x.y.z_x64-setup.exe` from the [latest release](https://github.com/zSimone35/TypogNotes/releases/latest).
2. Run the installer and follow the steps. No administrator rights are needed: the app is installed for the current user.
3. Open TypogNotes from the Start menu.

Requirements: 64-bit Windows 10 or 11 with Microsoft Edge WebView2, already present on up-to-date systems.

> The installer is not digitally signed: on first launch Windows SmartScreen may show a warning. Choose **More info › Run anyway**.

> **Updating from 1.0.0:** version 1.1.0 upgrades the local database, which 1.0.0 can no longer open. To be able to go back, copy `%LOCALAPPDATA%\com.typognotes.app` before installing it.

## How to use it

| Action | How |
|---|---|
| New note or new folder | Buttons at the top of the sidebar |
| New drawing note | Pen button next to **New note**, or **Drawing** in the Dashboard |
| Switch between notes | Tabs at the top of the Desk |
| Collapse a section | Arrow to the right of an H1, H2 or H3 heading |
| Change the paper color | Paper color menu in the toolbar |
| Insert an image | Image button in the toolbar, or Ctrl+V |
| Insert a table | Table button in the toolbar, then pick rows × columns |
| Add or delete rows and columns | Right-click a table cell |
| Image layout | Right-click the image |
| Quick formatting, recent colors, corrections | Right-click in the text |
| Checkbox shape | Right-click the Checklist button |
| Find and replace | Ctrl+F |
| Archive, move or pin a note | ⋯ menu or right-click the tab |

Saving is automatic: if it fails, a warning appears at the top right.

## Your data

Notes are stored in a SQLite database in the local Windows data folder
(`%LOCALAPPDATA%\com.typognotes.app`). No content is sent over the network.
Images are kept in the same database, together with the note that contains them.
Development builds (`npm run tauri dev`) run as a separate app, *TypogNotes Dev*, with their own data in
`%LOCALAPPDATA%\com.typognotes.app.dev`, so testing never touches your real notes.

## Development

**Prerequisites**
- Node.js 22 or later
- Rust stable with the `stable-msvc` toolchain
- Visual Studio Build Tools with the "Desktop development with C++" workload
- Microsoft Edge WebView2

```powershell
npm install
npm run tauri dev        # app in development
npm run tauri build      # NSIS installer in src-tauri/target/release/bundle/nsis
```

**Verification**

```powershell
npm run build                                       # type-check and frontend build
cargo test --manifest-path src-tauri/Cargo.toml     # backend tests
npm run test:e2e                                    # UI tests (Playwright)
```

The UI tests run in the browser with a mock backend (`e2e/tauri-mock.ts`), so you do not need to compile Rust to run them.

## Project structure

```
src/                    React + TypeScript interface
  components/           Desk, Dashboard, toolbar, drawing editor, menus, dialogs
  drawing/              ink rendering for drawing notes (perfect-freehand)
  editor/               Tiptap extensions: images, sections, lines, spell checking
  ui/                   Material shapes, menu positioning, recent colors
  styles/global.css     light and dark Material Design 3 theme
src-tauri/              Rust backend (Tauri 2)
  src/                  commands, database, note and drawing validation, export
  migrations/           versioned SQLite schema
  windows/              NSIS installer templates and images
e2e/                    Playwright tests
CHANGELOG.md            release notes, also shown in Settings › Information
scripts/                installer images and Material shape generation
```

## Feedback

Your feedback helps improve TypogNotes:

- 💬 **[Discussions](https://github.com/zSimone35/TypogNotes/discussions)**: comments, questions, opinions and ideas to talk about.
- 🐞 **[Report a problem](https://github.com/zSimone35/TypogNotes/issues/new?template=bug.yml)**: something is not working.
- 💡 **[Suggest an idea](https://github.com/zSimone35/TypogNotes/issues/new?template=idea.yml)**: a new feature or an improvement.

A (free) GitHub account is required.

## License

Released under the [MIT](LICENSE) license. The Material shapes in `scripts/vendor/` are derived
from AndroidX (Apache-2.0, see [`scripts/vendor/LICENSE`](scripts/vendor/LICENSE)).
