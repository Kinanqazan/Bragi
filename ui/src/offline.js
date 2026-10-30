const isNetworkFailure = (error) =>
  [502, 503, 504].includes(error?.status) ||
  error?.message === 'Failed to fetch' ||
  error?.message === 'Network request failed' ||
  error?.stack === 'TypeError: Failed to fetch'

export const handleNetworkFailure = (error) => {
  const failed = isNetworkFailure(error)
  if (
    failed &&
    typeof window !== 'undefined' &&
    window.BragiNative &&
    !window.location.pathname.endsWith('/offline.html')
  ) {
    window.location.replace('./offline.html')
  }
  return failed
}
