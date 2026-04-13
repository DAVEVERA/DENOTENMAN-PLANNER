import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET_KEY,
  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',
  },
  callbacks: {
    async signIn() {
      // Sta elke Google-gebruiker toe; beperk eventueel op domein:
      // return profile?.email?.endsWith('@denotenman.nl') ?? false
      return true
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Voeg het Google user-id toe aan de sessie
        ;(session.user as typeof session.user & { id: string }).id = token.sub
      }
      return session
    },
  },
}

export default NextAuth(authOptions)
