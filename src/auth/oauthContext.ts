import { createContext } from 'react'
import type { OAuthPort } from './oauthPort'
export const OAuthContext = createContext<OAuthPort | null>(null)
