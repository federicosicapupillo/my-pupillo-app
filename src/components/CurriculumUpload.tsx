import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Upload, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadCurriculum } from "@/lib/curriculum.functions";
import { CURRICULUM_BUCKET } from "@/lib/curriculum-file";
import { toast } from "sonner";
import { CurriculumAssessmentRequest } from '@/components/CurriculumAssessment';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type Curriculum = { storage_path: string; file_name: string; file_deleted_at: string | null };

export function CurriculumUpload({ userId }: { userId: string }) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [consent, setConsent] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadCurriculum);

  async function load() {
    const { data, error } = await supabase.from("worker_curricula").select("storage_path,file_name,file_deleted_at").eq("user_id", userId).maybeSingle();
    setLoadError(!!error);
    if (!error) setCurriculum(data);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [userId]);

  async function select(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set('assessmentConsent', String(consent));
      const result = await upload({ data: form });
      if (!result.ok) { toast.error(result.error); return; }
      await load();
      setConsent(false);
      if (result.assessmentError) toast.error(result.assessmentError);
      else toast.success("Curriculum caricato. Valutazione automatica avviata.");
    } catch { toast.error("Caricamento del curriculum non riuscito. Riprova."); }
    finally { setBusy(false); }
  }

  async function open() {
    if (!curriculum || curriculum.file_deleted_at) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const { data, error } = await supabase.storage.from(CURRICULUM_BUCKET).createSignedUrl(curriculum.storage_path, 60);
    if (error || !data) { tab?.close(); toast.error("Impossibile aprire il curriculum. Riprova."); return; }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  async function remove() {
    if (!curriculum) return;
    setBusy(true);
    try {
      const { error } = await supabase.storage.from(CURRICULUM_BUCKET).remove([curriculum.storage_path]);
      if (error) throw error;
      const { error: rowError } = await supabase.from("worker_curricula").delete().eq("user_id", userId);
      if (rowError) throw rowError;
      setCurriculum(null);
      toast.success("Curriculum e valutazione rimossi.");
    } catch { toast.error("Rimozione del curriculum non riuscita. Riprova."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2 border-t pt-4">
    <h4 className="font-medium">Curriculum <span className="text-sm font-normal text-muted-foreground">(facoltativo)</span></h4>
    <p className="text-xs text-muted-foreground">PDF · massimo 5 MB · documento privato</p>
    <p className="text-xs text-muted-foreground">Ogni nuovo curriculum viene valutato automaticamente. Il punteggio dipende dalle informazioni dichiarate.</p>
    <div className="flex items-start gap-2"><Checkbox id={`upload-cv-consent-${userId}`} checked={consent} disabled={busy} onCheckedChange={v => setConsent(v === true)} /><Label htmlFor={`upload-cv-consent-${userId}`} className="text-xs leading-relaxed">Acconsento all’analisi automatica tramite IA e alla pubblicazione del riconoscimento: 4 stelle di base per un curriculum leggibile con informazioni professionali, 5 per esperienze e competenze più solide. Non è una garanzia di qualità; il punteggio effettivo resta privato. File vuoti o illeggibili non ricevono stelle. Il PDF resta privato e viene eliminato dopo l’analisi; le dichiarazioni non sono verificate.</Label></div>
    <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Carica curriculum" onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) void select(file);
      e.target.value = "";
    }} />
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Caricamento curriculum" /> : loadError ?
      <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-destructive">Impossibile leggere il curriculum.</p><Button type="button" variant="outline" onClick={() => void load()}>Riprova</Button></div> : <>
        {curriculum && <p className="flex items-start gap-2 text-sm"><FileText className="h-4 w-4 shrink-0 mt-0.5" /><span className="break-all">{curriculum.file_name}{curriculum.file_deleted_at && <span className="block text-xs text-muted-foreground">File eliminato dopo l’analisi: resta solo la valutazione.</span>}</span></p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy || !consent} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{curriculum ? "Sostituisci curriculum" : "Carica curriculum"}
          </Button>
          {curriculum && <>
            {!curriculum.file_deleted_at && <Button type="button" variant="outline" disabled={busy} onClick={() => void open()}><ExternalLink className="h-4 w-4" />Apri</Button>}
            <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Rimuovi curriculum e valutazione" title="Rimuovi curriculum e valutazione" onClick={() => void remove()}><Trash2 className="h-4 w-4" /></Button>
          </>}
        </div>
        {curriculum && <CurriculumAssessmentRequest userId={userId} curriculumPath={curriculum.storage_path} />}
      </>}
  </div>;
}