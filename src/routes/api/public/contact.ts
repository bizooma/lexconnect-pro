import * as React from 'react'
import { render } from '@react-email/components'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import type { Database } from '@/integrations/supabase/types'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'LexGuild'
const SENDER_DOMAIN = 'notify.lexguild.com'
const FROM_DOMAIN = 'lexguild.com'

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  message: z.string().trim().min(1, 'Message is required').max(2000),
})

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function enqueueOne(
  supabase: SupabaseClient<Database>,
  templateName: string,
  recipientOverride: string | null,
  templateData: Record<string, any>,
) {
  const tpl = TEMPLATES[templateName]
  if (!tpl) throw new Error(`Template '${templateName}' not registered`)

  const recipient = (tpl.to || recipientOverride || '').toLowerCase()
  if (!recipient) throw new Error(`No recipient for template '${templateName}'`)

  // Suppression check
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipient)
    .maybeSingle()
  if (suppressed) return { skipped: true, reason: 'suppressed' }

  // Unsubscribe token (one per email)
  let unsubscribeToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', recipient)
    .maybeSingle()
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token as string
  } else if (!existing) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: recipient }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', recipient)
      .maybeSingle()
    unsubscribeToken = (stored?.token as string) || unsubscribeToken
  } else {
    return { skipped: true, reason: 'token_used' }
  }

  const element = React.createElement(tpl.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject

  const messageId = crypto.randomUUID()
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })
  if (enqueueError) throw new Error(`Enqueue failed: ${enqueueError.message}`)
  return { queued: true, messageId }
}

export const Route = createFileRoute('/api/public/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let parsed
        try {
          const body = await request.json()
          parsed = contactSchema.parse(body)
        } catch (err: any) {
          return Response.json(
            { error: 'Invalid input', details: err?.errors ?? String(err) },
            { status: 400 },
          )
        }

        const supabase = createClient<Database>(supabaseUrl, serviceKey)

        try {
          // Notify Joe (template has fixed recipient)
          await enqueueOne(supabase, 'contact-notification', null, parsed)
          // Confirmation to submitter
          await enqueueOne(supabase, 'contact-confirmation', parsed.email, {
            name: parsed.name,
            message: parsed.message,
          })
        } catch (err: any) {
          console.error('Contact form send failed', err)
          return Response.json({ error: 'Failed to send message' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
