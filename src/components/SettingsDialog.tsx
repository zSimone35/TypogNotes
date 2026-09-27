import { ShapePicker } from "./ShapePicker";
import { useState } from "react";
import { Modal } from "./Modal";
import { Download, Moon, Palette, PenLine, Shapes, X } from "lucide-react";
import type { AppSettings, ExportFormat, LayoutDensity, LineSpacing } from "../api/types";
import {
  EDITOR_FONTS,
  DICTIONARY_LANGUAGES,
  EXPORT_FORMATS,
  INTERFACE_FONTS,
  LINE_SPACINGS,
  MONOSPACE_FONTS,
} from "../options";

interface Props {
  settings: AppSettings;
  error: string;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

export function SettingsDialog({ settings, error, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(settings);
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Modal className="settings-dialog" labelledBy="settings-title" onClose={onClose}>
        <header className="dialog-header">
          <div><span className="eyebrow">Preferenze</span><h2 id="settings-title">Impostazioni</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi impostazioni"><X size={18} /></button>
        </header>
        <div className="settings-scroll thin-scrollbar">
          <SettingsSection icon={<Palette size={17} />} title="Aspetto">
            <div className="theme-grid">
              <button type="button" className={`theme-card${draft.theme !== "dark" ? " is-active" : ""}`} aria-pressed={draft.theme !== "dark"} onClick={() => update("theme", "soft")}><span className="theme-preview cream" /><span>Crema</span></button>
              <button type="button" className={`theme-card${draft.theme === "dark" ? " is-active" : ""}`} aria-pressed={draft.theme === "dark"} onClick={() => update("theme", "dark")}><span className="theme-preview dark" /><span>Tema scuro</span></button>
            </div>
            <div className="settings-grid">
              <SelectField label="Font interfaccia" value={draft.interfaceFont} onChange={(value) => update("interfaceFont", value as AppSettings["interfaceFont"])} options={INTERFACE_FONTS} />
              <SelectField label="Densità layout" value={draft.layoutDensity} onChange={(value) => update("layoutDensity", value as LayoutDensity)} options={[
                { id: "compact", label: "Compatto" },
                { id: "balanced", label: "Bilanciato" },
                { id: "spacious", label: "Ampio" },
              ]} />
            </div>
          </SettingsSection>

          <SettingsSection icon={<PenLine size={17} />} title="Scrittura">
            <div className="settings-grid">
              <SelectField label="Font del testo" value={draft.editorFont} onChange={(value) => update("editorFont", value as AppSettings["editorFont"])} options={EDITOR_FONTS} />
              <label className="settings-field"><span>Dimensione testo</span><input type="number" min={12} max={28} value={draft.editorFontSize} onChange={(event) => update("editorFontSize", Math.min(28, Math.max(12, Number(event.target.value))))} /></label>
              <SelectField label="Font monospace" value={draft.monospaceFont} onChange={(value) => update("monospaceFont", value as AppSettings["monospaceFont"])} options={MONOSPACE_FONTS} />
              <SelectField label="Interlinea nuove note" value={String(draft.defaultLineSpacing)} onChange={(value) => update("defaultLineSpacing", Number(value) as LineSpacing)} options={LINE_SPACINGS.map((item) => ({ id: String(item.id), label: item.label }))} />
              <SelectField label="Dizionario" value={draft.dictionaryLanguage} onChange={(value) => update("dictionaryLanguage", value as AppSettings["dictionaryLanguage"])} options={DICTIONARY_LANGUAGES} />
              <label className="toggle-field"><span><strong>Controllo ortografico</strong><small>Correzione locale, senza inviare il testo online</small></span><span className="switch"><input type="checkbox" role="switch" checked={draft.spellcheck} onChange={(event) => update("spellcheck", event.target.checked)} /><span className="switch-track" aria-hidden="true"><span className="switch-handle" /></span></span></label>
            </div>
          </SettingsSection>

          <SettingsSection icon={<Shapes size={17} />} title="Forme">
            <details><summary>Checkbox</summary><ShapePicker globalOnly value={draft.checkboxShape} onSelect={id => update("checkboxShape", id)} /></details>
          </SettingsSection>
          <SettingsSection icon={<Download size={17} />} title="Esportazione">
            <SelectField label="Formato predefinito" value={draft.defaultExportFormat} onChange={(value) => update("defaultExportFormat", value as ExportFormat)} options={EXPORT_FORMATS} />
          </SettingsSection>
        </div>
        {error && <p className="settings-error" role="alert">{error}</p>}
        <footer className="dialog-footer">
          <button type="button" className="secondary-action" onClick={onClose}>Annulla</button>
          <button type="button" className="primary-action" onClick={() => onSave(draft)}>Salva impostazioni</button>
        </footer>
    </Modal>
  );
}

function SettingsSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="settings-section"><h3>{icon}{title}</h3>{children}</section>;
}

function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
}) {
  return (
    <label className="settings-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
  );
}
