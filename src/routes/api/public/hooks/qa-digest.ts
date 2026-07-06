import * as React from 'react'
import { render } from '@react-email/components'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import type { Database } from '@/integrations/supabase/types'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'LexGuild'
const SENDER_DOMAIN = 'notify.lexguild.com'
const FROM_DOMAIN = 'lexguild.com'
const SITE_URL = 'https://lexguild.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getOrCreateUnsubToken(
  supabase: SupabaseClient<Database>,
  recipient: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', recipient)
    .maybeSingle()
  if (existing && !existing.used_at) return existing.token as string
  if (existing && existing.used_at) return null // user unsubscribed

  const token = generateToken()
  await supabase
    .from('email_unsubscribe_tokens')
    .upsert({ token, email: recipient }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: stored } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', recipient)
    .maybeSingle()
  return (stored?.token as string) || token
}

async function enqueueDigest(
  supabase: SupabaseClient<Database>,
  recipient: string,
  templateData: Record<string, any>,
) {
  const tpl = TEMPLATES['qa-digest']
  if (!tpl) throw new Error('qa-digest template not registered')

  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipient)
    .maybeSingle()
  if (suppressed) return { skipped: 'suppressed' as const }

  const unsubscribeToken = await getOrCreateUnsubToken(supabase, recipient)
  if (!unsubscribeToken) return { skipped: 'unsubscribed' as const }

  const element = React.createElement(tpl.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject

  const messageId = crypto.randomUUID()
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'qa-digest',
    recipient_email: recipient,
    status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
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
      label: 'qa-digest',
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) throw new Error(`Enqueue failed: ${error.message}`)
  return { queued: true as const }
}

export const Route = createFileRoute('/api/public/hooks/qa-digest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: apikey header must match the project anon key (canonical pg_cron pattern)
        const apikey = request.headers.get('apikey') ?? ''
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
        if (!apikey || !expectedAnon || apikey !== expectedAnon) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const supabase = createClient<Database>(supabaseUrl, serviceKey)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        // Load all users on digest mode
        const { data: prefs, error: prefsError } = await supabase
          .from('qa_notification_prefs')
          .select('user_id, organization_id')
          .eq('mode', 'digest')
        if (prefsError) {
          console.error('qa-digest: prefs load failed', prefsError)
          return Response.json({ error: 'Prefs query failed' }, { status: 500 })
        }
        if (!prefs || prefs.length === 0) {
          return Response.json({ sent: 0, skipped: 0, empty: 0, total: 0 })
        }

        // Cache org names and category names
        const orgIds = Array.from(new Set(prefs.map((p) => p.organization_id).filter(Boolean))) as string[]
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds)
        const orgNameById = new Map<string, string>((orgs ?? []).map((o) => [o.id, o.name]))

        const { data: cats } = await supabase
          .from('qa_categories')
          .select('id, name, organization_id')
          .in('organization_id', orgIds)
        const catNameById = new Map<string, string>((cats ?? []).map((c) => [c.id, c.name]))

        // Load all posts + replies in these orgs within the window (one shot each)
        const { data: recentPosts } = await supabase
          .from('qa_posts')
          .select('id, organization_id, author_id, title, category_id, created_at')
          .in('organization_id', orgIds)
          .gte('created_at', since)
          .order('created_at', { ascending: false })

        const { data: recentReplies } = await supabase
          .from('qa_replies')
          .select('id, post_id, organization_id, author_id, created_at, is_private')
          .in('organization_id', orgIds)
          .gte('created_at', since)
          .is('deleted_at', null)
          .eq('is_private', false)
          .order('created_at', { ascending: false })

        // Resolve reply parent titles
        const replyPostIds = Array.from(new Set((recentReplies ?? []).map((r) => r.post_id))) as string[]
        const { data: parentPosts } = replyPostIds.length
          ? await supabase.from('qa_posts').select('id, title').in('id', replyPostIds)
          : { data: [] as { id: string; title: string }[] }
        const postTitleById = new Map<string, string>((parentPosts ?? []).map((p) => [p.id, p.title]))

        // Author names
        const authorIds = Array.from(
          new Set([
            ...(recentPosts ?? []).map((p) => p.author_id),
            ...(recentReplies ?? []).map((r) => r.author_id),
            ...prefs.map((p) => p.user_id),
          ]),
        ) as string[]
        const { data: profiles } = authorIds.length
          ? await supabase.from('profiles').select('user_id, full_name').in('user_id', authorIds)
          : { data: [] as { user_id: string; full_name: string | null }[] }
        const nameById = new Map<string, string>(
          (profiles ?? []).map((p) => [p.user_id, p.full_name ?? '']),
        )

        let sent = 0
        let skipped = 0
        let empty = 0

        for (const pref of prefs) {
          const orgId = pref.organization_id
          const userId = pref.user_id
          if (!orgId || !userId) continue

          // Posts in this org, exclude user's own
          const posts = (recentPosts ?? []).filter(
            (p) => p.organization_id === orgId && p.author_id !== userId,
          )
          // Replies in this org, exclude user's own
          const replies = (recentReplies ?? []).filter(
            (r) => r.organization_id === orgId && r.author_id !== userId,
          )

          if (posts.length === 0 && replies.length === 0) {
            empty++
            continue
          }

          // Fetch email via auth admin
          const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(userId)
          if (userErr || !authUser?.user?.email) {
            skipped++
            continue
          }
          const recipient = authUser.user.email.toLowerCase()

          const templateData = {
            name: nameById.get(userId) || '',
            orgName: orgNameById.get(orgId) || SITE_NAME,
            totalCount: posts.length + replies.length,
            newPosts: posts.slice(0, 15).map((p) => ({
              title: p.title,
              url: `${SITE_URL}/app/qa/${p.id}`,
              category: p.category_id ? catNameById.get(p.category_id) : undefined,
              authorName: nameById.get(p.author_id) || undefined,
            })),
            newReplies: replies.slice(0, 15).map((r) => ({
              title: '',
              parentTitle: postTitleById.get(r.post_id) || 'a discussion',
              url: `${SITE_URL}/app/qa/${r.post_id}`,
              authorName: nameById.get(r.author_id) || undefined,
            })),
          }

          try {
            const result = await enqueueDigest(supabase, recipient, templateData)
            if ('queued' in result) sent++
            else skipped++
          } catch (err) {
            console.error('qa-digest: enqueue failed for user', userId, err)
            skipped++
          }
        }

        return Response.json({
          sent,
          skipped,
          empty,
          total: prefs.length,
          window_since: since,
        })
      },
    },
  },
})
