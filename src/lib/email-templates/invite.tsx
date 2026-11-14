import * as React from 'react'

import {
  Body,
  Img,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Sei stato invitato to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://pupillo.life/__l5e/assets-v1/4628e952-8afc-427b-9f23-249916e20032/pupillo_logo.png" alt="Pupillo" width="160" style={{ height: "auto", marginBottom: "20px" }} />
        <Heading style={h1}>Sei stato invitato</Heading>
        <Text style={text}>
          Sei stato invitato to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Accetta invito
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: 'inherit', textDecoration: 'underline' }
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
