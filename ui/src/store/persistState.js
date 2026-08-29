export const loadState = () => {
  try {
    const serializedState = localStorage.getItem('state')
    if (serializedState === null) {
      return undefined
    }
    return JSON.parse(serializedState)
  } catch (err) {
    return undefined
  }
}

let lastSerializedState

export const saveState = (state) => {
  try {
    const serializedState = JSON.stringify(state)
    if (serializedState === lastSerializedState) return
    localStorage.setItem('state', serializedState)
    lastSerializedState = serializedState
  } catch (err) {
    // Ignore write errors
  }
}
