const recordsToMap = (records) => {
  const data = {}
  for (const record of records) {
    Object.defineProperty(data, record.id, {
      configurable: true,
      enumerable: true,
      value: record,
      writable: true,
    })
  }
  return data
}

export default recordsToMap
