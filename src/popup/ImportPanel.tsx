import { useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { vi } from "../i18n/vi";

/** Collapsible "paste or choose a PGN" section of the ready screen. */
export function ImportPanel({ label, onAnalyze }: { label: string; onAnalyze: (pgn: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pgn, setPgn] = useState("");
  const [fileName, setFileName] = useState("");
  return <>
    <button className="secondary wide" aria-expanded={open} onClick={() => setOpen((value) => !value)}><FileUp/> {label}</button>
    {open && <section className="popup-import">
      <label>{vi.popup.importPgnLabel}<textarea value={pgn} onChange={(event) => setPgn(event.target.value)}/></label>
      <label className="file-picker"><Upload/> {fileName || vi.popup.chooseFile}<input type="file" accept=".pgn,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); void file.text().then(setPgn); } }}/></label>
      <button className="primary wide" disabled={!pgn.trim()} onClick={() => onAnalyze(pgn)}>{vi.popup.analyzeImported}</button>
    </section>}
  </>;
}
