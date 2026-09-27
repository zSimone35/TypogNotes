# TypogNotes

App desktop Windows local-first per note strutturate, costruita con Tauri 2,
Rust, React, TypeScript e Tiptap.

## Prerequisiti Windows

- Node.js 22 o successivo
- Rust stable con toolchain `stable-msvc`
- Visual Studio Build Tools con workload “Desktop development with C++”
- Microsoft Edge WebView2

Dopo l'installazione di Rust, riaprire il terminale per aggiornare `PATH`.

## Sviluppo

```powershell
npm install
npm run tauri dev
```

## Verifica

```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Il database locale viene creato nella directory `AppLocalData` assegnata da
Tauri a `com.typognotes.app`. Nessun contenuto viene inviato in rete.

Le firme IPC e il comportamento degli errori sono definiti in
[`docs/tauri-commands.md`](docs/tauri-commands.md).
