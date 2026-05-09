import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'LexGuild'

interface ContactConfirmationProps {
  name?: string
  message?: string
}

const ContactConfirmationEmail = ({ name, message }: ContactConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for reaching out to {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Thanks, ${name}!` : 'Thanks for reaching out!'}
        </Heading>
        <Text style={text}>
          We received your message and Joe at Bizooma Creative Agency — the team
          behind {SITE_NAME} — will get back to you shortly.
        </Text>
        {message ? (
          <>
            <Text style={label}>Your message:</Text>
            <Text style={quote}>{message}</Text>
          </>
        ) : null}
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactConfirmationEmail,
  subject: `Thanks for contacting ${SITE_NAME}`,
  displayName: 'Contact form confirmation',
  previewData: { name: 'Jane Doe', message: 'I have a question about pricing.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const label = { fontSize: '12px', color: '#64748b', margin: '24px 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const quote = { fontSize: '14px', color: '#0f172a', lineHeight: '1.6', padding: '12px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', margin: '0 0 24px', whiteSpace: 'pre-wrap' as const }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
