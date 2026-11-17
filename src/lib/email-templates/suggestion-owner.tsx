import React from "react";
import { Html, Head, Preview, Body, Container, Heading, Text, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";

function SuggestionEmail({ message, userId }: { message?: string; userId?: string }) {
  return <Html lang="it"><Head /><Preview>È arrivato un suggerimento per Pupillo</Preview><Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}><Container style={{ maxWidth: "560px", padding: "28px 24px" }}>
    <Heading>Nuovo suggerimento per Pupillo</Heading>
    <Text style={{ whiteSpace: "pre-wrap" }}>{message}</Text>
    <Text>Utente: {userId}</Text>
    <Button href="https://pupillo.life/admin">Apri l’area amministrativa</Button>
  </Container></Body></Html>;
}

export const template = {
  component: SuggestionEmail,
  subject: "Nuovo suggerimento · Pupillo",
  to: "federico.sica@gmail.com",
  displayName: "Suggerimento ricevuto",
  previewData: { message: "Vorrei proporre un miglioramento della ricerca.", userId: "Utente" },
} satisfies TemplateEntry;