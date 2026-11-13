import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  title?: string
  body?: string
  ctaLabel?: string
  ctaUrl?: string
  starUrls?: string[]
}

const NotificationEmail = ({ title, body, ctaLabel, ctaUrl, starUrls }: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{title || 'Hai una nuova notifica su Pupillo'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Pupillo</Text>
        <Heading style={h1}>{title || 'Nuova notifica'}</Heading>
        {body ? <Text style={text}>{body}</Text> : null}
        {starUrls && starUrls.length === 5 ? (
          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            <Text style={small}>Quante stelle dai? Tocca una stella:</Text>
            <Text style={{ margin: 0 }}>
              {starUrls.map((u, i) => (
                <Link key={i} href={u} style={star}>★</Link>
              ))}
            </Text>
            <Text style={small}>Si apre Pupillo con il voto già inserito: aggiungi i dettagli e conferma.</Text>
          </Section>
        ) : null}
        {ctaUrl ? (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={ctaUrl} style={button}>{ctaLabel || 'Apri Pupillo'}</Button>
          </Section>
        ) : null}
        <Text style={footer}>Puoi scegliere quali email ricevere dalla pagina Profilo di Pupillo.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NotificationEmail,
  subject: (d: Record<string, any>) => (d.title ? `${d.title} · Pupillo` : 'Nuova notifica su Pupillo'),
  displayName: 'Notifica importante',
  previewData: {
    title: 'Turno completato — lascia una recensione',
    body: 'Com’è andato il turno di sabato? Lascia la tua recensione.',
    ctaLabel: 'Lascia la recensione',
    ctaUrl: 'https://pupillo.life/messages/123?action=review',
    starUrls: [1, 2, 3, 4, 5].map((n) => `https://pupillo.life/messages/123?action=review&rating=${n}`),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const brand = { fontSize: '20px', fontWeight: 800, color: '#7c3aed', margin: '0 0 16px' }
const h1 = { fontSize: '22px', color: '#111111', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '22px', color: '#333333' }
const small = { fontSize: '13px', color: '#666666', margin: '6px 0' }
const star = { fontSize: '36px', color: '#f5b301', textDecoration: 'none', padding: '0 4px' }
const button = { backgroundColor: '#c6f432', color: '#111111', fontWeight: 700, fontSize: '15px', padding: '14px 26px', borderRadius: '12px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#888888', marginTop: '28px' }
