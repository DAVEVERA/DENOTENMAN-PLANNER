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

  if (user.role === 'inspector') {
    return { redirect: { destination: '/inspectie', permanent: false } }
  }

  // Admin or manager → planning grid
  if (can(user, 'manage_shifts')) {
    return { redirect: { destination: '/admin', permanent: false } }
  }

  // Employees open the complete roster; personal and location-specific views remain in navigation.
  return { redirect: { destination: '/team/both', permanent: false } }
}
