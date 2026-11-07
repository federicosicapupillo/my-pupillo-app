import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ReputationLevelsExplanation() {
  return <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Come vengono assegnati i livelli" title="Come vengono assegnati i livelli">
        <Info className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Livelli di reputazione Pupillo</DialogTitle>
        <DialogDescription>Si basano sui turni e sul profilo. Sono separati dalle stelle del curriculum e non sono abbonamenti a pagamento.</DialogDescription>
      </DialogHeader>
      <dl className="space-y-3 text-sm">
        <div><dt className="font-semibold">Nuovo</dt><dd className="text-muted-foreground">Meno di 3 turni completati, senza tutti i requisiti di Nuovo verificato.</dd></div>
        <div><dt className="font-semibold">Nuovo verificato</dt><dd className="text-muted-foreground">Meno di 3 turni completati, con profilo completo, telefono verificato e foto caricata. Non certifica le competenze né l’autenticità delle esperienze.</dd></div>
        <div><dt className="font-semibold">Basic</dt><dd className="text-muted-foreground">Almeno 3 turni completati, senza raggiungere i requisiti di Pro o Elite.</dd></div>
        <div><dt className="font-semibold">Pro</dt><dd className="text-muted-foreground">Almeno 5 turni completati e Reputation Score di almeno 75/100.</dd></div>
        <div><dt className="font-semibold">Elite</dt><dd className="text-muted-foreground">Almeno 15 turni completati, Reputation Score di almeno 90/100 e nessuna mancata presentazione.</dd></div>
      </dl>
      <section className="space-y-2 border-t pt-4 text-sm">
        <h3 className="font-semibold">Come si calcola il Reputation Score</h3>
        <p className="text-muted-foreground">Il punteggio da 0 a 100 viene mostrato dopo almeno 3 turni completati.</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>Affidabilità operativa: fino a 40 punti, considerando completamento dei turni, puntualità, mancate presentazioni, cancellazioni e incidenti verificati.</li>
          <li>Qualità delle valutazioni ricevute: fino a 25 punti.</li>
          <li>Professionalità, collaborazione e disponibilità dei ristoratori a richiamare il lavoratore: fino a 15 punti.</li>
          <li>Esperienza nei turni su Pupillo: fino a 10 punti.</li>
          <li>Profilo completo, telefono verificato, foto e documento caricato: fino a 10 punti.</li>
        </ul>
        <p className="text-xs text-muted-foreground">La rapidità di risposta non è ancora misurata nel calcolo: la relativa voce assegna attualmente 3 punti fissi nell’affidabilità operativa.</p>
      </section>
      <p className="border-t pt-4 text-sm text-muted-foreground">Un lavoratore può avere 4 o 5 stelle sul curriculum e risultare ancora Nuovo: il curriculum valuta le informazioni dichiarate, mentre il livello riguarda la reputazione maturata su Pupillo.</p>
    </DialogContent>
  </Dialog>;
}