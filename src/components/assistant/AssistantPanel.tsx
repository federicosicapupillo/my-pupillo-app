import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send, Bot, AlertTriangle, MessageCircle, X, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth-context";
import {
  getContextualFaqs,
  welcomeMessage,
  ERROR_FAQS,
  type AssistantFaq,
  type AssistantCta,
} from "@/lib/assistant-kb";
import { askAssistant, type AssistantReply } from "@/lib/assistant.functions";
import { ReportProblemDialog } from "@/components/assistant/ReportProblemDialog";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cta?: AssistantCta | null;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AssistantPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const { role } = useAuth();
  const loc = useLocation();
  const ask = useServerFn(askAssistant);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const welcome = useMemo(() => welcomeMessage(role), [role]);
  const faqs = useMemo(() => getContextualFaqs(loc.pathname, role), [loc.pathname, role]);
  const visibleFaqs = showAllFaqs ? faqs : faqs.slice(0, 6);

  // Reset when reopening on a different page or when opening the panel
  useEffect(() => {
    if (open) {
      setShowAllFaqs(false);
      setMessages([]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 50);
    }
  }, [open, loc.pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res: AssistantReply = await ask({
        data: { message: trimmed, role: role ?? null, pathname: loc.pathname, history },
      });
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: res.reply, cta: res.cta ?? null },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Non riesco a verificarlo automaticamente. Puoi inviare una segnalazione al supporto.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const askFaq = (faq: AssistantFaq) => {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", content: faq.question },
      { id: uid(), role: "assistant", content: faq.answer, cta: faq.cta ?? null },
    ]);
  };

  const pageUrl =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : loc.pathname;

  const body = (
    <div className="flex h-full flex-col">
      {/* Back to topics */}
      {messages.length > 0 && (
        <div className="border-b bg-background px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMessages([])}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Torna agli argomenti
          </Button>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Welcome */}
        <div className="flex items-start gap-2">
          <div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
          <div className="rounded-2xl bg-muted/60 px-3 py-2 text-sm max-w-[85%]">{welcome}</div>
        </div>

        {/* Quick FAQs */}
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Domande rapide</div>
            <div className="flex flex-wrap gap-2">
              {visibleFaqs.map((f) => (
                <button
                  key={f.id}
                  onClick={() => askFaq(f)}
                  className="text-xs rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition"
                >
                  {f.question}
                </button>
              ))}
            </div>
            {faqs.length > 6 && !showAllFaqs && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowAllFaqs(true)}
              >
                Mostra altre domande
              </button>
            )}
            <div className="pt-3 text-xs uppercase tracking-wide text-muted-foreground">Problemi comuni</div>
            <div className="flex flex-wrap gap-2">
              {ERROR_FAQS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => askFaq(f)}
                  className="text-xs rounded-full border border-destructive/30 bg-destructive/5 text-foreground px-3 py-1.5 hover:bg-destructive/10 transition"
                >
                  {f.question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex items-start gap-2", m.role === "user" ? "justify-end" : "")}
          >
            {m.role === "assistant" && (
              <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0"><Bot className="h-4 w-4" /></div>
            )}
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60",
              )}
            >
              {m.content}
              {m.role === "assistant" && m.cta && (
                <div className="mt-2">
                  <Link to={m.cta.to as never} onClick={() => onOpenChange(false)}>
                    <Button size="sm" variant="secondary" className="h-7 text-xs">{m.cta.label}</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
            <div className="rounded-2xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Sto pensando…</div>
          </div>
        )}
      </div>

      <div className="border-t bg-background p-3 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi una domanda…"
            disabled={sending}
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Invia">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-xs text-muted-foreground"
          onClick={() => setReportOpen(true)}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Segnala un problema
        </Button>
      </div>

      <ReportProblemDialog open={reportOpen} onOpenChange={setReportOpen} pageUrl={pageUrl} />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh] flex flex-col">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <DrawerTitle>Assistenza Pupillo</DrawerTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Chiudi">
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          <DrawerDescription className="sr-only">Chat di assistenza</DrawerDescription>
          <div className="flex-1 min-h-0">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            Assistenza Pupillo
          </SheetTitle>
          <SheetDescription className="text-xs">Risposte rapide e link diretti alle pagine giuste.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">{body}</div>
      </SheetContent>
    </Sheet>
  );
}