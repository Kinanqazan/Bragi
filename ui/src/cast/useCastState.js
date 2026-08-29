import { useEffect, useState } from 'react'
import { getCastState, initializeCast, subscribeCastState } from './castApi'

export const useCastState = () => {
  const [state, setState] = useState(getCastState)

  useEffect(() => {
    const unsubscribe = subscribeCastState(setState)
    initializeCast().catch(() => undefined)
    return unsubscribe
  }, [])

  return state
}
