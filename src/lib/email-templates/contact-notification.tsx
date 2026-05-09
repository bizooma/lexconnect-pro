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

interface ContactNotificationProps {
  name?: string
  email?: string
  message?: string
}

const ContactNotificationEmail = ({ name, email, message }: ContactNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New LexGuild contact form submission</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact form submission</Heading>
        <Text style={row}><strong>Name:</strong> {name || '(not provided)'}</Text>
        <Text style={row}><strong>Email:</strong> {email || '(not provided)'}</Text>
        <Text style={label}>Message</Text>
        <Text style={quote}>{message || '(empty)'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New LexGuild contact: ${data?.name || data?.email || 'Anonymous'}`,
  displayName: 'Contact form notification (to Joe)',
  to: 'joe@bizooma.com',
  previewData: { name: 'Jane Doe', email: 'jane@example.com', message: 'I have a question.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const row = { fontSize: '14px', color: '#0f172a', margin: '0 0 8px' }
const label = { fontSize: '12px', color: '#64748b', margin: '20px 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const quote = { fontSize: '14px', color: '#0f172a', lineHeight: '1.6', padding: '12px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', margin: '0', whiteSpace: 'pre-wrap' as const }
