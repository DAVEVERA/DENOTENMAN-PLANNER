import type { GetServerSideProps } from 'next'

import AdminLayout from '../../components/layout/AdminLayout'
import AdminChatManager from '../../components/team-chat/AdminChatManager'
import { getSession } from '../../lib/auth'
import type { SessionUser } from '../../types'

interface Props { user: SessionUser }

export default function AdminTeamChatPage({ user }: Props) {
  return <AdminLayout user={user} title="Chatbeheer"><AdminChatManager /></AdminLayout>
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getSession(req, res)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
