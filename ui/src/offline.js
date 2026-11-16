const isNetworkFailure = (error) =>
  [502, 503, 504].includes(error?.status) ||
  error?.message === 'Failed to fetch' ||
  error?.message === 'Network request failed' ||
  error?.stack === 'TypeError: Failed to fetch'

export const handleNetworkFailure = (error) => isNetworkFailure(error)
