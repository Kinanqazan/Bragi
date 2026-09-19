import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import authProvider from './authProvider'

// Helper to create a base64url encoded JWT with given exp claim
const makeFakeJwt = (exp) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ uid: 'user-1', exp }))
  return `${header}.${payload}.signature`
}

describe('authProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('checkAuth', () => {
    it('rejects when is-authenticated is not set', async () => {
      await expect(authProvider.checkAuth()).rejects.toBeUndefined()
    })

    it('resolves when is-authenticated is set and token is unexpired', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
      localStorage.setItem('is-authenticated', 'true')
      localStorage.setItem('token', makeFakeJwt(futureExp))

      await expect(authProvider.checkAuth()).resolves.toBeUndefined()
    })

    it('rejects, purges tokens, and redirects to login when token is expired', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600 // 1 hour in past
      localStorage.setItem('is-authenticated', 'true')
      localStorage.setItem('token', makeFakeJwt(pastExp))
      localStorage.setItem('userId', 'user-1')

      await expect(authProvider.checkAuth()).rejects.toEqual(
        expect.objectContaining({
          redirectTo: '/login',
          message: 'Session expired. Please log in again.',
        }),
      )

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('is-authenticated')).toBeNull()
      expect(localStorage.getItem('userId')).toBeNull()
    })

    it('resolves when is-authenticated is set without a token (legacy or ext-auth mode)', async () => {
      localStorage.setItem('is-authenticated', 'true')
      await expect(authProvider.checkAuth()).resolves.toBeUndefined()
    })
  })

  describe('checkError', () => {
    it('removes tokens and rejects on 401 status', async () => {
      localStorage.setItem('token', 'some-token')
      localStorage.setItem('is-authenticated', 'true')

      await expect(authProvider.checkError({ status: 401 })).rejects.toBeUndefined()

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('is-authenticated')).toBeNull()
    })

    it('resolves on non-401 errors', async () => {
      await expect(authProvider.checkError({ status: 500 })).resolves.toBeUndefined()
      await expect(authProvider.checkError({ status: 404 })).resolves.toBeUndefined()
    })
  })
})
