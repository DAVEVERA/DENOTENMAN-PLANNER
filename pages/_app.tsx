import type { AppProps } from 'next/app'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import '@/styles/globals.css'

// Dynamisch laden zodat het geen SSR-fouten geeft
const DaveChat = dynamic(() => import('@/components/ui/DaveChat'), { ssr: false })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
      <DaveChat />
    </>
  )
}
