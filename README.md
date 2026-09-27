<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="Logo TypogNotes" />

# TypogNotes

**Scrivere meglio, ogni giorno.**

App desktop per Windows per prendere note su un foglio a righe, ordinarle in cartelle
e ritrovarle subito. Tutto resta sul tuo computer: niente account, niente cloud.

[![Scarica per Windows](https://img.shields.io/github/v/release/zSimone35/TypogNotes?label=Scarica%20per%20Windows&style=for-the-badge&color=855133)](https://github.com/zSimone35/TypogNotes/releases/latest)

![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-2024-000000?logo=rust)
![SQLite](https://img.shields.io/badge/SQLite-locale-003B57?logo=sqlite)
![Licenza MIT](https://img.shields.io/badge/licenza-MIT-green)

<img src="assets/screenshots/scrivania.png" alt="La Scrivania: la nota su foglio a righe con il nastro degli strumenti" width="900" />

</div>

## Indice

- [Funzionalità](#funzionalità)
- [Galleria](#galleria)
- [Installazione](#installazione)
- [Come si usa](#come-si-usa)
- [I tuoi dati](#i-tuoi-dati)
- [Sviluppo](#sviluppo)
- [Struttura del progetto](#struttura-del-progetto)
- [Feedback](#feedback)
- [Licenza](#licenza)

## Funzionalità

**Scrittura**
- Foglio a righe con interlinea regolabile: titoli, elenchi, checklist, codice e immagini restano sempre allineati alle righe.
- Titoli H1–H3 con **sezioni pieghevoli**: la freccia a destra del titolo nasconde il contenuto sotto.
- Formattazione completa: font per selezione, dimensione, grassetto, corsivo, sottolineato, barrato, allineamento.
- **Palette 10×8** per testo ed evidenziatore, colori personalizzati e **colori recenti di ogni nota**.
- Blocchi di codice con evidenziazione della sintassi (14 linguaggi) e copia rapida.
- **Immagini** (PNG, JPEG, WebP, GIF, BMP) da pulsante o con Ctrl+V, in 5 disposizioni: in linea, testo a capo, interrompi testo, dietro o davanti al testo.
- Divisori orizzontali con spessore da 1 a 8 px (tasto destro sul pulsante o sulla linea).
- Controllo ortografico offline in italiano, inglese, francese, spagnolo e tedesco, con dizionario personale; ignora i blocchi di codice.
- Trova e sostituisci (Ctrl+F) e indice della nota generato dai titoli.

**Organizzazione**
- **Bacheca** per navigare cartelle e note: ricerca, filtri, ordinamento, vista a griglia o elenco, trascina una nota su una cartella per spostarla.
- **Schede** delle note della cartella nella parte alta della Scrivania, riordinabili con il trascinamento o con le frecce.
- Note in evidenza, segnate come "da sistemare", selezione multipla per spostare o eliminare.
- **Archivio** e **Cestino** come pagine a sé: apri una nota in sola lettura, ripristinala o eliminala definitivamente.

**Aspetto**
- Interfaccia Material Design 3 con tema chiaro e scuro.
- 16 colori del foglio, con nomi dedicati nel tema scuro.
- Modalità focus, barra laterale comprimibile, nastro degli strumenti ridimensionabile.

**Esportazione**
- Markdown, HTML e PDF.

## Galleria

| Bacheca | Tema scuro |
|---|---|
| <img src="assets/screenshots/bacheca.png" alt="Bacheca con cartelle e note" /> | <img src="assets/screenshots/scrivania-scura.png" alt="Scrivania nel tema scuro" /> |
| **Colori del foglio** | **Palette testo ed evidenziatore** |
| <img src="assets/screenshots/fogli.png" alt="Menu dei 16 colori del foglio" /> | <img src="assets/screenshots/palette.png" alt="Palette dei colori del testo" /> |
| **Cestino** | |
| <img src="assets/screenshots/cestino-scuro.png" alt="Pagina del Cestino con le note come schede" /> | |

## Installazione

1. Scarica `TypogNotes_x.y.z_x64-setup.exe` dall'[ultima release](https://github.com/zSimone35/TypogNotes/releases/latest).
2. Avvia il programma di installazione e segui i passaggi. Non servono i permessi di amministratore: l'app viene installata per l'utente corrente.
3. Apri TypogNotes dal menu Start.

Requisiti: Windows 10 o 11 a 64 bit con Microsoft Edge WebView2, già presente nei sistemi aggiornati.

> L'installer non è firmato digitalmente: al primo avvio Windows SmartScreen può mostrare un avviso. Scegli **Ulteriori informazioni › Esegui comunque**.

## Come si usa

| Azione | Come |
|---|---|
| Nuova nota o nuova cartella | Pulsanti in alto nella barra laterale |
| Passare da una nota all'altra | Schede in alto nella Scrivania |
| Piegare una sezione | Freccia a destra di un titolo H1, H2 o H3 |
| Cambiare il colore del foglio | Nastro › Nota › menu del colore |
| Inserire un'immagine | Pulsante immagine nel nastro oppure Ctrl+V |
| Disposizione di un'immagine | Tasto destro sull'immagine |
| Formattazione veloce, colori recenti, correzioni | Tasto destro nel testo |
| Forma delle checkbox | Tasto destro sul pulsante Checklist |
| Trova e sostituisci | Ctrl+F |
| Archiviare, spostare, fissare una nota | Menu ⋯ o tasto destro sulla scheda |

Il salvataggio è automatico: se non riesce, compare un avviso in alto a destra.

## I tuoi dati

Le note sono salvate in un database SQLite nella cartella dati locale di Windows
(`%LOCALAPPDATA%\com.typognotes.app`). Nessun contenuto viene inviato in rete.
Le immagini sono conservate nello stesso database, insieme alla nota che le contiene.

## Sviluppo

**Prerequisiti**
- Node.js 22 o successivo
- Rust stable con toolchain `stable-msvc`
- Visual Studio Build Tools con il workload "Desktop development with C++"
- Microsoft Edge WebView2

```powershell
npm install
npm run tauri dev        # app in sviluppo
npm run tauri build      # installer NSIS in src-tauri/target/release/bundle/nsis
```

**Verifica**

```powershell
npm run build                                       # type-check e build del frontend
cargo test --manifest-path src-tauri/Cargo.toml     # test del backend
npm run test:e2e                                    # test dell'interfaccia (Playwright)
```

I test dell'interfaccia girano nel browser con un finto backend (`e2e/tauri-mock.ts`), quindi non serve compilare Rust per eseguirli.

## Struttura del progetto

```
src/                    interfaccia React + TypeScript
  components/           Scrivania, Bacheca, nastro, menu, dialoghi
  editor/               estensioni Tiptap: immagini, sezioni, righe, ortografia
  ui/                   forme Material, posizionamento dei menu, colori recenti
  styles/global.css     tema Material Design 3 chiaro e scuro
src-tauri/              backend Rust (Tauri 2)
  src/                  comandi, database, validazione delle note, esportazione
  migrations/           schema SQLite versionato
  windows/              template e immagini dell'installer NSIS
e2e/                    test Playwright
scripts/                immagini dell'installer e generazione delle forme Material
```

## Feedback

Il tuo parere aiuta a migliorare TypogNotes:

- 💬 **[Discussioni](https://github.com/zSimone35/TypogNotes/discussions)**: commenti, domande, opinioni e idee da discutere.
- 🐞 **[Segnala un problema](https://github.com/zSimone35/TypogNotes/issues/new?template=bug.yml)**: qualcosa non funziona.
- 💡 **[Proponi un'idea](https://github.com/zSimone35/TypogNotes/issues/new?template=idea.yml)**: una funzione nuova o un miglioramento.

Serve un account GitHub (gratuito).

## Licenza

Distribuito con licenza [MIT](LICENSE). Le forme Material in `scripts/vendor/` derivano
da AndroidX (Apache-2.0, vedi [`scripts/vendor/LICENSE`](scripts/vendor/LICENSE)).
