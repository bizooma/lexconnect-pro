import { useEffect, useState } from 'react'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'valid' | 'used' | 'invalid' | 'confirming' | 'success' | 'error'

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || '' }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const { token } = useSearch({ from: '/unsubscribe' })
  const [status, setStatus] = useState<Status>('loading')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) { setStatus('invalid'); return }
        if (data.used) { setStatus('used'); setEmail(data.email ?? null); return }
        setStatus('valid'); setEmail(data.email ?? null)
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const confirm = async () => {
    setStatus('confirming')
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      setStatus(r.ok ? 'success' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4 border border-border rounded-lg p-8">
        <h1 className="text-2xl font-semibold">Email preferences</h1>
        {status === 'loading' && <p className="text-muted-foreground">Checking your link…</p>}
        {status === 'invalid' && <p className="text-muted-foreground">This unsubscribe link is invalid or expired.</p>}
        {status === 'used' && <p className="text-muted-foreground">{email ?? 'This address'} is already unsubscribed.</p>}
        {status === 'valid' && (
          <>
            <p className="text-muted-foreground">Click below to unsubscribe {email ?? 'this address'} from LexGuild emails.</p>
            <Button onClick={confirm}>Confirm unsubscribe</Button>
          </>
        )}
        {status === 'confirming' && <p className="text-muted-foreground">Processing…</p>}
        {status === 'success' && <p className="text-foreground">You've been unsubscribed.</p>}
        {status === 'error' && <p className="text-destructive">Something went wrong. Please try again.</p>}
      </div>
    </main>
  )
}
