import type { AppProps } from 'next/app'
import Head from 'next/head'
import '@/styles/globals.css'
import AutomaticPushNotifications from '@/components/ui/AutomaticPushNotifications'
import CrispChat from '@/components/ui/CrispChat'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <AutomaticPushNotifications />
      <CrispChat />
      <Component {...pageProps} />
    </>
  )
}
