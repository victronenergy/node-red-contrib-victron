function parseItemsChangedEntry (entry) {
  const m = { changed: true }
  m.path = entry[0]

  if (entry[1]) {
    entry[1].forEach(v => {
      switch (v[0]) {
        case 'Value':
          m.value = v[1][1][0]
          break
        case 'Text':
          m.text = v[1][1][0]
          break
      }
    })
  }

  return m
}

function processItemsChanged (msg, services, searchDeviceInstanceByName) {
  const messages = []

  if (!msg.body || !msg.body[0]) {
    return messages
  }

  msg.body[0].forEach(entry => {
    const m = parseItemsChangedEntry(entry)

    if (!m.path || m.value === null) {
      return
    }

    const service = services[msg.sender]
    if (!service || !service.name) {
      return
    }

    if (m.path === '/DeviceInstance') {
      service.deviceInstance = m.value
    }

    m.senderName = service.name.split('.').splice(0, 3).join('.')

    if (service.deviceInstance === null) {
      service.deviceInstance = searchDeviceInstanceByName(services, m.senderName, '')
    }

    m.deviceInstance = service.deviceInstance
    messages.push(m)
  })

  return messages
}

module.exports = {
  parseItemsChangedEntry,
  processItemsChanged
}
