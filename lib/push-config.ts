export interface PublicPushConfiguration {
  configured: boolean
  publicKey: string | null
}

export function getPublicPushConfiguration(
  publicKey: string | undefined,
  privateKey: string | undefined,
): PublicPushConfiguration {
  const normalizedPublicKey = publicKey?.trim()
  const configured = Boolean(normalizedPublicKey && privateKey?.trim())

  return {
    configured,
    publicKey: configured ? normalizedPublicKey! : null,
  }
}
