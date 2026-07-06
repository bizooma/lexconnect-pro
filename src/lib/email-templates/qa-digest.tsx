import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface DigestItem {
  title: string
  url: string
  category?: string
  authorName?: string
  isReply?: boolean
  parentTitle?: string
}

interface QaDigestProps {
  name?: string
  orgName?: string
  newPosts?: DigestItem[]
  newReplies?: DigestItem[]
  totalCount?: number
}

const QaDigestEmail = ({
  name,
  orgName,
  newPosts = [],
  newReplies = [],
  totalCount = 0,
}: QaDigestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {totalCount > 0
        ? `${totalCount} new discussion${totalCount === 1 ? '' : 's'} in ${orgName || 'your community'}`
        : `Your daily digest from ${orgName || 'LexGuild'}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Daily Q&amp;A digest</Heading>
        <Text style={intro}>
          {name ? `Hi ${name},` : 'Hi there,'} here's what's new in{' '}
          <strong>{orgName || 'your community'}</strong> over the last 24 hours.
        </Text>

        {newPosts.length > 0 && (
          <Section style={block}>
            <Text style={sectionLabel}>New questions</Text>
            {newPosts.map((item, i) => (
              <Text key={`p-${i}`} style={row}>
                <Link href={item.url} style={link}>{item.title}</Link>
                <span style={meta}>
                  {item.category ? ` · ${item.category}` : ''}
                  {item.authorName ? ` · by ${item.authorName}` : ''}
                </span>
              </Text>
            ))}
          </Section>
        )}

        {newReplies.length > 0 && (
          <Section style={block}>
            <Text style={sectionLabel}>New replies</Text>
            {newReplies.map((item, i) => (
              <Text key={`r-${i}`} style={row}>
                <Link href={item.url} style={link}>
                  Reply on "{item.parentTitle || item.title}"
                </Link>
                <span style={meta}>
                  {item.authorName ? ` · by ${item.authorName}` : ''}
                </span>
              </Text>
            ))}
          </Section>
        )}

        {newPosts.length === 0 && newReplies.length === 0 && (
          <Text style={row}>No new activity in the last 24 hours.</Text>
        )}

        <Text style={footer}>
          Manage your notification preferences from Settings inside LexGuild.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QaDigestEmail,
  subject: (data: Record<string, any>) => {
    const n = data?.totalCount ?? 0
    const org = data?.orgName || 'LexGuild'
    return n > 0
      ? `${n} new discussion${n === 1 ? '' : 's'} in ${org}`
      : `Your daily digest from ${org}`
  },
  displayName: 'Q&A daily digest',
  previewData: {
    name: 'Jane',
    orgName: 'LexGuild',
    totalCount: 2,
    newPosts: [
      {
        title: 'How do you handle probate exemptions?',
        url: 'https://example.com/app/qa/1',
        category: 'Probate',
        authorName: 'Alex',
      },
    ],
    newReplies: [
      {
        title: '',
        parentTitle: 'What CLE providers do you recommend?',
        url: 'https://example.com/app/qa/2',
        authorName: 'Sam',
      },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 12px' }
const intro = { fontSize: '14px', color: '#334155', margin: '0 0 20px', lineHeight: '1.6' }
const block = { margin: '0 0 24px' }
const sectionLabel = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 'bold' as const,
}
const row = { fontSize: '14px', color: '#0f172a', margin: '0 0 10px', lineHeight: '1.5' }
const link = { color: '#0f172a', fontWeight: 'bold' as const, textDecoration: 'underline' }
const meta = { color: '#64748b', fontSize: '13px', fontWeight: 'normal' as const }
const footer = { fontSize: '12px', color: '#64748b', margin: '28px 0 0', lineHeight: '1.5' }
