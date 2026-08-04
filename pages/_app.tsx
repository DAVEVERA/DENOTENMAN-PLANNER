import type { AppProps } from 'next/app'
import Head from 'next/head'
import '@/styles/globals.css'
import AutomaticPushNotifications from '@/components/ui/AutomaticPushNotifications'
import CrispChat from '@/components/ui/CrispChat'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isInspection = router.pathname.startsWith('/inspectie')
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      {!isInspection && <AutomaticPushNotifications />}
      {!isInspection && <CrispChat />}
      <Component {...pageProps} />
    </>
  )
}
