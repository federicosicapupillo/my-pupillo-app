import { z } from "zod";

export const suggestionSchema = z.object({
  message: z.string().trim().min(1, "Scrivi il tuo suggerimento.").max(2000, "Il suggerimento può contenere al massimo 2000 caratteri."),
});