import webpush from 'web-push'
import { supabase, T, unwrap } from './db'
import type { PushSubscriptionRow, SessionUser } from '@/types'

let vapidReady = false

function init() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY niet geconfigureerd — push-notificaties uitgeschakeld')
    return
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:info@mnrv.nl',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  vapidReady = true
}
init()

export async function savePushSubscription(
  user: Pick<SessionUser, 'user_id' | 'employee_id'>,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<void> {
  await supabase.from(T('push_subscriptions')).upsert({
    employee_id: user.employee_id,
    user_id:     user.user_id,
    endpoint:    sub.endpoint,
    p256dh:      sub.keys.p256dh,
    auth:        sub.keys.auth,
    user_agent:  userAgent ?? null,
  }, { onConflict: 'endpoint' })
}

export async function sendPushToEmployee(
  employeeId: number,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!vapidReady) return
  const subs = unwrap<PushSubscriptionRow[]>(
    await supabase.from(T('push_subscriptions')).select('*').eq('employee_id', employeeId),
  )
  await Promise.allSettled(subs.map(s =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
    ),
  ))
}

export interface PushDeliveryResult {
  configured: boolean
  total: number
  fulfilled: number
  rejected: number
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string }): Promise<PushDeliveryResult> {
  if (!vapidReady) return { configured: false, total: 0, fulfilled: 0, rejected: 0 }
  const subs = unwrap<PushSubscriptionRow[]>(await supabase.from(T('push_subscriptions')).select('*'))
  const results = await Promise.allSettled(subs.map(s =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
    ),
  ))
  return {
    configured: true,
    total: results.length,
    fulfilled: results.filter(result => result.status === 'fulfilled').length,
    rejected: results.filter(result => result.status === 'rejected').length,
  }
}

/** Aantal actieve push-abonnementen (voor diagnostiek in admin dashboard) */
export async function getPushSubscriptionCount(): Promise<number> {
  const { count } = await supabase
    .from(T('push_subscriptions'))
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}
