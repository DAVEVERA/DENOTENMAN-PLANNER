import type { GetServerSideProps } from 'next'

import TeamLayout from '../../components/layout/TeamLayout'
import ChatWorkspace from '../../components/team-chat/ChatWorkspace'
import { getSession } from '../../lib/auth'
import type { SessionUser } from '../../types'

interface Props { user: SessionUser }

export default function TeamChatPage({ user }: Props) {
  return (
    <TeamLayout user={user}>
      <ChatWorkspace user={user} />
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getSession(req, res)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
