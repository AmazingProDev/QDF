"use client";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

export function UploadPanel({ label, description, file, onFile }: { label: "BEFORE" | "AFTER" | "RÉFÉRENCE OOKLA"; description: string; file?: File; onFile: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null); const [dragging, setDragging] = useState(false);
  const accept = (candidate?: File) => { if (!candidate) return; if (!/\.(xlsx|xlsm)$/i.test(candidate.name)) { window.alert("Veuillez sélectionner un fichier .xlsx ou .xlsm."); return; } onFile(candidate); };
  return <section className={`upload-card ${dragging ? "is-dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }}>
    <div className="upload-label">{label}</div><h2>{label === "BEFORE" ? "Référence initiale" : label === "AFTER" ? "Qualification finale" : "Référence KPI et trafic"}</h2><p>{description}</p>
    {file ? <div className="file-ready"><FileSpreadsheet size={24} /><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} Mo</span></div><button aria-label={`Retirer ${label}`} onClick={() => onFile(undefined)}><X size={18} /></button></div> : <button className="dropzone" onClick={() => input.current?.click()}><Upload size={24} /><span>Glissez votre fichier ici</span><small>ou parcourir · .xlsx, .xlsm</small></button>}
    {file && <button className="replace" onClick={() => input.current?.click()}>Remplacer le fichier</button>}
    <input ref={input} hidden type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => accept(e.target.files?.[0])} />
  </section>;
}
