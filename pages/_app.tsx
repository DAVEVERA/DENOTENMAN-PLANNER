import type { AppProps } from 'next/app'
import Head from 'next/head'
import { SessionProvider } from 'next-auth/react'
import '@/styles/globals.css'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name={"viewport"} content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel={"manifest"} href="/manifest.json" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
