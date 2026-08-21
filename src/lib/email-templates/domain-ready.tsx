import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export interface DomainReadyEmailProps {
  orgName: string
  domain: string
  mode: string
}

export const DomainReadyEmail = ({ orgName, domain, mode }: DomainReadyEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Domain ready to connect: {domain}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Domain ready to connect</Heading>
        <Text style={text}>
          A tenant custom domain has passed DNS verification and now needs to be added manually in
          the Lovable dashboard.
        </Text>
        <Text style={text}>
          <strong>Organization:</strong> {orgName}
          <br />
          <strong>Domain:</strong> {domain}
          <br />
          <strong>Mode:</strong> {mode}
        </Text>
        <Text style={text}>
          Add it under <strong>Settings → Domains</strong> in the Lovable dashboard. Do not set it
          as the primary domain.
        </Text>
        <Text style={footer}>
          Then mark it as “Connected in Lovable” in the platform admin custom domains queue.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default DomainReadyEmail

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
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
