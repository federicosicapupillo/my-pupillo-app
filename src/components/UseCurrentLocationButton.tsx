import * as React from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { reverseGeocode } from "@/lib/geocode";
import { WORKER_CITIES, zonesForCity } from "@/lib/worker-cities";

type LocatedPayload = {
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  onLocated: (data: LocatedPayload) => void;
  disabled?: boolean;
};

/**
 * Button that asks the browser for the current GPS position, reverse-geocodes
 * it via Nominatim, and hands the matched city / quartiere / coordinates back
 * to the parent. Shown above the manual address fallback in the GeoRadar
 * section of the worker onboarding.
 */
export function UseCurrentLocationButton({ onLocated, disabled }: Props) {
  const [loading, setLoading] = React.useState(false);

  function pickKnownCity(detected: string): string {
    const norm = detected.toLowerCase();
    const direct = (WORKER_CITIES as readonly string[]).find(
      (c) => c.toLowerCase() === norm,
    );
    if (direct) return direct;
    // Fuzzy: contained either way (handles "Roma Capitale" / "Comune di Milano")
    const partial = (WORKER_CITIES as readonly string[]).find(
      (c) => norm.includes(c.toLowerCase()) || c.toLowerCase().includes(norm),
    );
    return partial ?? detected;
  }

  function handleClick() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocalizzazione non supportata dal browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await reverseGeocode(latitude, longitude);
          if (!r.ok) {
            toast.error("Impossibile recuperare la posizione");
            return;
          }
          const matchedCity = pickKnownCity(r.city);
          // Try to find a known zone matching the detected district.
          const candidates = zonesForCity(matchedCity);
          const district =
            candidates.find(
              (z) => z.toLowerCase() === r.district.toLowerCase(),
            ) ??
            candidates.find((z) =>
              r.district.toLowerCase().includes(z.toLowerCase()),
            ) ??
            r.district;
          // Build a short, non-precise address (street/landmark from displayName).
          const parts = r.displayName.split(",").map((s) => s.trim());
          const address = parts.slice(0, 2).join(", ") || matchedCity;
          onLocated({
            city: matchedCity,
            district,
            address,
            lat: r.lat,
            lng: r.lng,
          });
          toast.success("Posizione rilevata correttamente");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(
            "Consenti l'accesso alla posizione per usare il GeoRadar",
          );
        } else {
          toast.error("Impossibile recuperare la posizione");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      onClick={handleClick}
      disabled={loading || disabled}
      className="w-full sm:w-auto"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="mr-2 h-4 w-4" />
      )}
      {loading ? "Rilevamento posizione…" : "Usa la mia posizione attuale"}
    </Button>
  );
}