import type { GetServerSideProps } from 'next'
import { getSession, can } from '@/lib/auth'

// Smart redirect based on role
export default function IndexPage() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }

  const user = session.user

  // Admin or manager → planning grid
  if (can(user, 'manage_shifts')) {
    return { redirect: { destination: '/admin', permanent: false } }
  }

  // Employee → team view for their location, else /me
  if (user.location && user.location !== 'both') {
    return { redirect: { destination: `/team/${user.location}`, permanent: false } }
  }

  return { redirect: { destination: '/me', permanent: false } }
}
