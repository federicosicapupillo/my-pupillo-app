import * as React from 'react'

import {
  Body,
  Img,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo codice per {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://pupillo.life/__l5e/assets-v1/4628e952-8afc-427b-9f23-249916e20032/pupillo_logo.png" alt="Pupillo" width="160" style={{ height: "auto", marginBottom: "20px" }} />
        <Heading style={h1}>Il tuo codice Pupillo</Heading>
        <Text style={text}>Inserisci questo codice su Pupillo per confermare la tua email e proseguire.</Text>
        {token ? <Text style={{ fontSize: '40px', lineHeight: '48px', fontFamily: 'Courier, monospace', fontWeight: 700, color: '#111111', margin: '24px 0', textAlign: 'center' }}><strong>{token}</strong></Text> : <Button style={button} href={confirmationUrl}>Accedi a Pupillo</Button>}
        <Text style={footer}>
          Se non hai richiesto questo codice, ignora l’email. Non condividere il codice con altre persone.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#D8FF36',
  color: '#111111',
  fontSize: '14px',
  border: '1px solid #D8FF36',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
