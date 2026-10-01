export const songShowPath = (record) => {
  const id = record?.mediaFileId || record?.id
  return id ? `/song/${encodeURIComponent(id)}/show` : null
}

export const openSong = (history, location, record) => {
  const pathname = songShowPath(record)
  if (!pathname) return

  history.push({
    pathname,
    state: {
      returnTo: `${location.pathname}${location.search}`,
    },
  })
}
