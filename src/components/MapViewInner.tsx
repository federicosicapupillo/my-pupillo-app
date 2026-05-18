import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";

export type MapCategory = "restaurant" | "worker" | "announcement";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  category: MapCategory;
  title: string;
  subtitle?: string;
  city?: string | null;
  status?: string | null;
  link?: string;
  meta?: {
    secondaryRoles?: string[];
    rating?: number | null;
    reliability?: number | null;
    completedShifts?: number | null;
    hourlyRate?: number | null;
    availability?: string[];
    badge?: string | null;
    distanceKm?: number | null;
    contactName?: string | null;
    contactRole?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    coordSource?: "job" | "location" | "profile" | "service_area";
    // worker-view announcement popup
    workerView?: boolean;
    confirmed?: boolean;
    cancelled?: boolean;
    venueType?: string | null;
    zoneLabel?: string | null;
    role?: string | null;
    serviceDate?: string | null;
    serviceTime?: string | null;
    durationHours?: number | null;
    tariffAmount?: number | null;
    tariffType?: string | null;
    generalDescription?: string | null;
    requirements?: string[];
    servicesAtVenue?: number;
    announcementId?: string;
    operationalNotes?: string | null;
    fullAddress?: string | null;
    restaurantName?: string | null;
    knownRestaurant?: boolean;
    // Reputazione/livello richiesto per candidarsi (opzionali)
    requiredBadge?: string | null;
    requiredLevel?: string | null;
    minRating?: number | null;
    minCompletedShifts?: number | null;
  };
};

// Pupillo neon palette
const COLORS: Record<MapCategory, string> = {
  restaurant: "#FF2EA8",   // magenta
  worker: "#D8FF36",       // lime
  announcement: "#22E0CF", // cyan
};

const makeIcon = (category: MapCategory) => {
  const c = COLORS[category];
  if (category === "worker") {
    return L.divIcon({
      className: "",
      html: `<div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:${c};opacity:.25;filter:blur(6px);"></div>
        <div style="position:relative;width:22px;height:22px;border-radius:50%;background:${c};border:2px solid #07060B;box-shadow:0 0 0 2px ${c}66, 0 4px 10px rgba(0,0,0,.5);"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:${c};opacity:.3;filter:blur(8px);"></div>
      <div style="position:relative;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:2px solid #07060B;box-shadow:0 0 0 2px ${c}55, 0 4px 12px rgba(0,0,0,.6);"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
};

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);
  return null;
}

// Chiusura popup con ESC + focus management accessibile.
// - All'apertura del popup salva l'elemento attivo precedente e sposta il
//   focus sul primo elemento interattivo dentro al popup, marcandolo con
//   role="dialog" e aria-modal per gli screen reader.
// - Su ESC chiude tutti i popup e ripristina il focus all'elemento di
//   partenza (di solito il marker).
function PopupA11y() {
  const map = useMap();
  useEffect(() => {
    const prevFocusRef: { el: HTMLElement | null } = { el: null };

    const onPopupOpen = (e: any) => {
      const popupEl: HTMLElement | undefined = e.popup?.getElement?.();
      if (!popupEl) return;
      // Marca il popup come dialog per AT.
      popupEl.setAttribute("role", "dialog");
      popupEl.setAttribute("aria-modal", "false");
      popupEl.setAttribute("aria-label", "Anteprima annuncio");
      const content = popupEl.querySelector<HTMLElement>(".leaflet-popup-content");
      if (content) {
        content.setAttribute("tabindex", "-1");
      }
      // Salva il focus precedente.
      prevFocusRef.el = (document.activeElement as HTMLElement) || null;
      // Sposta il focus sul primo elemento interattivo (o sul contenuto).
      requestAnimationFrame(() => {
        const focusable = popupEl.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        (focusable || content || popupEl).focus({ preventScroll: true });
      });
    };

    const onPopupClose = () => {
      // Ripristina il focus all'elemento precedente se ancora nel DOM.
      const prev = prevFocusRef.el;
      prevFocusRef.el = null;
      if (prev && document.body.contains(prev)) {
        try { prev.focus({ preventScroll: true }); } catch { /* noop */ }
      }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      // Chiudi solo se c'è un popup aperto sulla mappa.
      const open = document.querySelector(".leaflet-popup");
      if (!open) return;
      ev.stopPropagation();
      map.closePopup();
    };

    map.on("popupopen", onPopupOpen);
    map.on("popupclose", onPopupClose);
    const container = map.getContainer();
    container.addEventListener("keydown", onKeyDown);
    // Anche a livello document per intercettare ESC quando il focus è
    // dentro al popup (che è figlio del map container).
    document.addEventListener("keydown", onKeyDown);
    return () => {
      map.off("popupopen", onPopupOpen);
      map.off("popupclose", onPopupClose);
      container.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [map]);
  return null;
}

// Chiude la preview aperta quando la lista dei punti cambia (filtri,
// categoria, ricerca, ecc.). Senza questo, un popup ancorato a un marker
// rimosso può restare "orfano" sulla mappa.
function ClosePopupOnPointsChange({ signature }: { signature: string }) {
  const map = useMap();
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    map.closePopup();
  }, [signature, map]);
  return null;
}

export default function MapViewInner({ points, height, center, focusZoom, me, radiusKm }: { points: MapPoint[]; height: number; center: [number, number]; focusZoom?: number; me?: { lat: number; lng: number } | null; radiusKm?: number | null }) {
  // Firma stabile della lista di punti: cambia quando filtri/categoria
  // modificano l'insieme visualizzato → triggera la chiusura della preview.
  const pointsSignature = useMemo(
    () => `${points.length}:${points.map((p) => `${p.category}-${p.id}`).join("|")}`,
    [points]
  );
  // Desktop con mouse: hover apre la preview, mouseout la chiude con un
  // piccolo delay (così l'utente può spostarsi sopra il popup senza che
  // sparisca). Su touch (mobile/tablet): tap toglie/mette la preview.
  const hasHover = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const markerHandlers = useMemo(() => {
    if (hasHover) {
      return {
        mouseover: (e: any) => { cancelClose(); e.target.openPopup(); },
        mouseout: (e: any) => {
          cancelClose();
          closeTimerRef.current = setTimeout(() => {
            e.target.closePopup();
          }, 250);
        },
        // Click chiude il popup se aperto, altrimenti lo apre — utile per
        // chi usa il mouse ma vuole "pinnare" la preview con un click.
        click: (e: any) => { cancelClose(); e.target.openPopup(); },
      };
    }
    // Touch: tap apre, tap fuori chiude (closePopupOnClick di Leaflet).
    return {
      click: (e: any) => e.target.openPopup(),
    };
  }, [hasHover]);
  // Mantieni il popup aperto se l'utente sposta il puntatore dentro al popup.
  const popupHandlers = hasHover
    ? { mouseover: cancelClose, mouseout: (e: any) => { closeTimerRef.current = setTimeout(() => e.target._source?.closePopup(), 250); } }
    : undefined;
  useEffect(() => () => cancelClose(), []);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.7)]" style={{ height }}>
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom
        closePopupOnClick
        style={{ height: "100%", width: "100%" }}
      >
        <Recenter center={center} zoom={focusZoom} />
        <PopupA11y />
        <ClosePopupOnPointsChange signature={pointsSignature} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        {me && (
          <>
            <CircleMarker
              center={[me.lat, me.lng]}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
            >
              <Popup>La tua posizione</Popup>
            </CircleMarker>
            {radiusKm && radiusKm > 0 && (
              <Circle
                center={[me.lat, me.lng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#2563eb", fillOpacity: 0.08 }}
              />
            )}
          </>
        )}
        {points.map((p) => (
          <Marker
            key={`${p.category}-${p.id}`}
            position={[p.lat, p.lng]}
            icon={makeIcon(p.category)}
            eventHandlers={markerHandlers}
          >
            <Popup maxWidth={320} minWidth={260} autoClose closeOnClick eventHandlers={popupHandlers as any}>
              {p.category === "announcement" && p.meta?.workerView ? (
                <WorkerAnnouncementPopup p={p} />
              ) : (
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                {p.subtitle && <div style={{ fontSize: 12, color: "#555" }}>{p.subtitle}</div>}
                {p.city && <div style={{ fontSize: 12, color: "#555" }}>{p.city}</div>}
                {p.meta && (
                  <div style={{ fontSize: 12, color: "#444", marginTop: 4, lineHeight: 1.5 }}>
                    {p.meta.secondaryRoles && p.meta.secondaryRoles.length > 0 && (
                      <div>Anche: {p.meta.secondaryRoles.join(", ")}</div>
                    )}
                    {p.meta.rating != null && <div>⭐ {Number(p.meta.rating).toFixed(1)}</div>}
                    {p.meta.reliability != null && <div>Affidabilità: {p.meta.reliability}%</div>}
                    {p.meta.completedShifts != null && <div>Turni: {p.meta.completedShifts}</div>}
                    {p.meta.hourlyRate != null && <div>Tariffa: € {Number(p.meta.hourlyRate).toFixed(0)}/h</div>}
                    {p.meta.availability && p.meta.availability.length > 0 && (
                      <div>Disponibile: {p.meta.availability.join(", ")}</div>
                    )}
                    {p.meta.distanceKm != null && (
                      <div>📍 {p.meta.distanceKm < 1 ? `${Math.round(p.meta.distanceKm * 1000)} m` : `${p.meta.distanceKm.toFixed(1)} km`} da te</div>
                    )}
                    {p.meta.contactName && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Referente:</strong> {p.meta.contactName}
                        {p.meta.contactRole ? ` (${p.meta.contactRole})` : ""}
                      </div>
                    )}
                    {p.meta.contactPhone && (
                      <div>📞 <a href={`tel:${p.meta.contactPhone}`} style={{ color: COLORS[p.category] }}>{p.meta.contactPhone}</a></div>
                    )}
                    {p.meta.contactEmail && (
                      <div>✉️ <a href={`mailto:${p.meta.contactEmail}`} style={{ color: COLORS[p.category] }}>{p.meta.contactEmail}</a></div>
                    )}
                    {p.meta.coordSource && (
                      <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 10, color: "#7c3aed" }}>
                        🛠 coord: {p.meta.coordSource}
                      </div>
                    )}
                  </div>
                )}
                {p.status && <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>Stato: {p.status}</div>}
                {p.link && (
                  <a href={p.link} style={{ color: COLORS[p.category], fontSize: 12, marginTop: 6, display: "inline-block" }}>
                    {p.category === "worker" ? "Vedi profilo →" : "Apri dettaglio →"}
                  </a>
                )}
              </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function fmtDate(s?: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" }); }
  catch { return s; }
}
function fmtTime(s?: string | null, durationH?: number | null) {
  if (!s) return null;
  const hhmm = s.slice(0, 5);
  if (!durationH) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Math.round(durationH * 60);
  const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const em = String(total % 60).padStart(2, "0");
  return `${hhmm} - ${eh}:${em}`;
}
function fmtTariff(amount?: number | null, type?: string | null, hours?: number | null) {
  if (amount == null) return null;
  if (type === "hourly") {
    const tot = hours ? ` (tot. circa €${(Number(amount) * Number(hours)).toFixed(0)})` : "";
    return `€${Number(amount).toFixed(0)}/h${tot}`;
  }
  return `€${Number(amount).toFixed(0)}`;
}

// Sezione "ordinata" con titolo + chips e fallback se mancano dati.
function ChipSection({
  title,
  items,
  emptyLabel,
  tone = "neutral",
}: {
  title: string;
  items: (string | null | undefined)[];
  emptyLabel: string;
  tone?: "neutral" | "accent";
}) {
  const clean = (items || []).filter((x): x is string => !!x && x.trim().length > 0);
  const bg = tone === "accent" ? "#ecfeff" : "#f3f4f6";
  const fg = tone === "accent" ? "#0e7490" : "#374151";
  const border = tone === "accent" ? "#a5f3fc" : "#e5e7eb";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
        {title}
      </div>
      {clean.length === 0 ? (
        <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {clean.map((t, i) => (
            <span
              key={`${t}-${i}`}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: fg,
                background: bg,
                border: `1px solid ${border}`,
                padding: "2px 6px",
                borderRadius: 999,
                lineHeight: 1.4,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function reputationItems(m: MapPoint["meta"]): string[] {
  if (!m) return [];
  const out: string[] = [];
  if (m.requiredBadge) out.push(`🏅 ${m.requiredBadge}`);
  if (m.requiredLevel) out.push(`Livello: ${m.requiredLevel}`);
  if (m.minRating != null) out.push(`⭐ min ${Number(m.minRating).toFixed(1)}`);
  if (m.minCompletedShifts != null) out.push(`Min ${m.minCompletedShifts} turni`);
  return out;
}

function WorkerAnnouncementPopup({ p }: { p: MapPoint }) {
  const m = p.meta || {};
  const accent = COLORS.announcement;
  const cancelled = m.cancelled;
  const confirmed = m.confirmed;
  const detailsHref = `/announcements/${m.announcementId || p.id}`;

  // Stato 5: annullato → minimo
  if (cancelled) {
    return (
      <div style={{ minWidth: 240 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Servizio annullato</div>
        <div style={{ fontSize: 12, color: "#555" }}>
          {m.venueType || "Locale"}{m.zoneLabel ? ` · zona ${m.zoneLabel}` : ""}
        </div>
        {m.role && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{m.role}</div>}
      </div>
    );
  }

  // Stato 4: confermato da entrambi → dati completi
  if (confirmed) {
    return (
      <div style={{ minWidth: 260 }}>
        <div style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: "#065f46", background: "#d1fae5", padding: "2px 6px", borderRadius: 999, marginBottom: 6 }}>
          ✓ Servizio confermato
        </div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.restaurantName || p.title}</div>
        {m.role && <div style={{ fontSize: 12, color: "#555" }}>{m.role}</div>}
        <div style={{ fontSize: 12, color: "#333", marginTop: 6, lineHeight: 1.5 }}>
          {m.fullAddress && <div>📍 {m.fullAddress}</div>}
          {fmtDate(m.serviceDate) && <div>📅 {fmtDate(m.serviceDate)}</div>}
          {fmtTime(m.serviceTime, m.durationHours) && <div>🕒 {fmtTime(m.serviceTime, m.durationHours)}{m.durationHours ? ` · ${m.durationHours}h` : ""}</div>}
          {fmtTariff(m.tariffAmount, m.tariffType, m.durationHours) && <div>💶 {fmtTariff(m.tariffAmount, m.tariffType, m.durationHours)}</div>}
          {m.contactName && <div style={{ marginTop: 4 }}><strong>Referente:</strong> {m.contactName}{m.contactRole ? ` (${m.contactRole})` : ""}</div>}
          {m.contactPhone && <div>📞 <a href={`tel:${m.contactPhone}`} style={{ color: accent }}>{m.contactPhone}</a></div>}
          {m.contactEmail && <div>✉️ <a href={`mailto:${m.contactEmail}`} style={{ color: accent }}>{m.contactEmail}</a></div>}
          {m.operationalNotes && (
            <div style={{ marginTop: 6, padding: 6, background: "#f5f5f5", borderRadius: 4, fontSize: 11 }}>
              <strong>Note operative:</strong> {m.operationalNotes}
            </div>
          )}
        </div>
        <ChipSection
          title="Reputazione richiesta"
          items={reputationItems(m)}
          emptyLabel="Aperto a tutti i livelli reputazionali"
          tone="accent"
        />
        <ChipSection
          title="Requisiti"
          items={m.requirements || []}
          emptyLabel="Nessun requisito specifico indicato"
        />
        <a href={detailsHref} style={{ display: "inline-block", marginTop: 8, color: accent, fontSize: 12, fontWeight: 600 }}>
          Apri dettagli →
        </a>
      </div>
    );
  }

  // Stati 1-3: prima della conferma reciproca → solo dati autorizzati
  const showRealName = !!m.restaurantName; // true quando knownRestaurant
  return (
    <div style={{ minWidth: 260 }}>
      {showRealName ? (
        <>
          <div style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: "#065f46", background: "#d1fae5", padding: "2px 6px", borderRadius: 999, marginBottom: 6 }}>
            ✓ Hai già lavorato qui
          </div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.restaurantName}</div>
          {(m.venueType || m.zoneLabel) && (
            <div style={{ fontSize: 12, color: "#555" }}>
              {m.venueType || "Locale"}{m.zoneLabel ? ` · ${m.zoneLabel}` : ""}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: "#1e3a8a", background: "#dbeafe", padding: "2px 6px", borderRadius: 999, marginBottom: 6 }}>
            🔒 Locale verificato
          </div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {m.venueType || "Ristorante partner"}{m.zoneLabel ? ` — zona ${m.zoneLabel}` : ""}
          </div>
          <div style={{ fontSize: 11, color: "#777" }}>Nome visibile dopo la conferma</div>
        </>
      )}
      {m.role && <div style={{ fontSize: 13, color: "#333", marginTop: 2 }}>Cerca {m.role}</div>}
      <div style={{ fontSize: 12, color: "#444", marginTop: 6, lineHeight: 1.5 }}>
        {fmtDate(m.serviceDate) && <div>📅 {fmtDate(m.serviceDate)}</div>}
        {fmtTime(m.serviceTime, m.durationHours) && <div>🕒 {fmtTime(m.serviceTime, m.durationHours)}</div>}
        {m.durationHours && <div>⏱ Durata stimata: {m.durationHours}h</div>}
        {fmtTariff(m.tariffAmount, m.tariffType, m.durationHours) && (
          <div>💶 Compenso previsto: {fmtTariff(m.tariffAmount, m.tariffType, m.durationHours)}</div>
        )}
        {m.distanceKm != null && (
          <div>📍 Distanza indicativa: {m.distanceKm < 1 ? `${Math.round(m.distanceKm * 1000)} m` : `circa ${m.distanceKm.toFixed(1)} km`}</div>
        )}
        {m.servicesAtVenue != null && m.servicesAtVenue > 1 && (
          <div>📋 {m.servicesAtVenue} servizi disponibili in questo locale</div>
        )}
        {m.generalDescription && (
          <div style={{ marginTop: 4 }}>
            <em>{m.generalDescription.length > 140 ? `${m.generalDescription.slice(0, 140)}…` : m.generalDescription}</em>
          </div>
        )}
      </div>
      <ChipSection
        title="Reputazione richiesta"
        items={reputationItems(m)}
        emptyLabel="Aperto a tutti i livelli reputazionali"
        tone="accent"
      />
      <ChipSection
        title="Requisiti"
        items={m.requirements || []}
        emptyLabel="Nessun requisito specifico indicato"
      />
      {!showRealName && (
        <div style={{ marginTop: 8, padding: 6, background: "#fff7e6", border: "1px solid #fde68a", borderRadius: 4, fontSize: 11, color: "#92400e", lineHeight: 1.4 }}>
          🔒 Indirizzo e contatti visibili dopo la conferma del servizio.
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <a href={detailsHref} style={{ flex: 1, textAlign: "center", padding: "6px 10px", border: `1px solid ${accent}`, color: accent, borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          Apri annuncio
        </a>
        <a href={`${detailsHref}?apply=1`} style={{ flex: 1, textAlign: "center", padding: "6px 10px", background: accent, color: "#07060B", borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          Candidati
        </a>
      </div>
    </div>
  );
}