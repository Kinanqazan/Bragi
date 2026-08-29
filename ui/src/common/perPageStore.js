export const defaultRowsPerPageOptions = [10, 25, 50, 100]

export const getStoredPerPage = (
  resourceOrOptions,
  optionsOrFallback,
  fallbackVal,
) => {
  let options = defaultRowsPerPageOptions
  let fallback = 10

  if (Array.isArray(resourceOrOptions)) {
    options = resourceOrOptions
    if (typeof optionsOrFallback === 'number') fallback = optionsOrFallback
  } else if (Array.isArray(optionsOrFallback)) {
    options = optionsOrFallback
    if (typeof fallbackVal === 'number') fallback = fallbackVal
  } else if (typeof resourceOrOptions === 'number') {
    fallback = resourceOrOptions
  }

  const stored = parseInt(
    localStorage.getItem('itemsPerPage') ||
      (typeof resourceOrOptions === 'string'
        ? localStorage.getItem(`perPage.${resourceOrOptions}`)
        : null),
    10,
  )

  return options.includes(stored) ? stored : fallback
}

export const setStoredPerPage = (perPageOrResource, perPageVal) => {
  const value =
    typeof perPageVal === 'number' || typeof perPageVal === 'string'
      ? perPageVal
      : perPageOrResource
  localStorage.setItem('itemsPerPage', String(value))
}

