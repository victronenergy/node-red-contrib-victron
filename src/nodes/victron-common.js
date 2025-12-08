/* global $ */

export function initializeTooltips () {
  $('.tooltip-container').remove()

  $('.tooltip-icon').off('mouseenter mouseleave')

  $('.tooltip-icon').on('mouseenter', function (e) {
    const $icon = $(this)
    const tooltipText = $icon.attr('data-tooltip')
    const $tooltip = $('<div class="tooltip-container"></div>').text(tooltipText)

    $('body').append($tooltip)

    const iconOffset = $icon.offset()
    const tooltipHeight = $tooltip.outerHeight()
    const tooltipWidth = $tooltip.outerWidth()

    $tooltip.css({
      top: iconOffset.top - tooltipHeight - 8,
      left: iconOffset.left - (tooltipWidth / 2) + ($icon.outerWidth() / 2)
    })

    $icon.data('tooltip-element', $tooltip)
  })

  $('.tooltip-icon').on('mouseleave', function () {
    const $icon = $(this)
    const $tooltip = $icon.data('tooltip-element')
    if ($tooltip) {
      $tooltip.remove()
      $icon.removeData('tooltip-element')
    }
  })
}

/**
 * Filter services based on blacklist patterns
 * @param {Array} services - Array of service objects
 * @returns {Array} Filtered services
 */
export function filterBlacklistedServices (services) {
  const blacklist = [
    /^com\.victronenergy\.adc/,
    /^com\.victronenergy\.ble/,
    /^com\.victronenergy\.fronius/,
    /^com\.victronenergy\.modbusclient\.tcp/,
    /^com\.victronenergy\.shelly/,
    /^com\.victronenergy\.vecan\./
  ]

  return services.filter(function (service) {
    return !blacklist.some(function (pattern) {
      return pattern.test(service.service)
    })
  })
}

/**
 * Filter paths to only numeric types (for conditional comparisons)
 * @param {Array} paths - Array of path objects
 * @returns {Array} Filtered paths
 */
export function filterNumericPaths (paths) {
  return paths.filter(function (path) {
    return path.type === 'float' ||
           path.type === 'integer' ||
           path.type === 'boolean' ||
           path.type === 'number'
  })
}

/**
 * Count services by name to determine if device instance should be shown
 * @param {Array} services - Array of service objects
 * @returns {Object} Map of service name to count
 */
export function countServicesByName (services) {
  const counts = {}
  services.forEach(function (service) {
    counts[service.name] = (counts[service.name] || 0) + 1
  })
  return counts
}

/**
 * Get friendly service type name from D-Bus service path
 * @param {string} servicePath - D-Bus service path (e.g., "com.victronenergy.tank.socketcan_can0_vi0_uc6536")
 * @returns {string} Friendly service type name (e.g., "Tank Sensor")
 */
export function getServiceTypeName (servicePath) {
  // Service type mapping (matches registerInputNode calls)
  const serviceTypeMap = {
    accharger: 'AC Charger',
    acload: 'AC Load',
    acsystem: 'AC System',
    alternator: 'Alternator',
    battery: 'Battery Monitor',
    dcdc: 'DC-DC',
    dcload: 'DC Load',
    dcsource: 'DC Source',
    dcsystem: 'DC System',
    dess: 'Dynamic ESS',
    digitalinput: 'Digital Input',
    ess: 'ESS',
    evcharger: 'EV Charger',
    fuelcell: 'Fuel cell',
    generator: 'Generator',
    gps: 'GPS',
    gridmeter: 'Grid Meter',
    inverter: 'Inverter',
    meteo: 'Meteo',
    motordrive: 'E-drive',
    multi: 'Multi RS',
    pulsemeter: 'Pulsemeter',
    pump: 'Pump',
    pvinverter: 'PV Inverter',
    relay: 'Relay',
    settings: 'Settings',
    solarcharger: 'Solar Charger',
    switch: 'Switch',
    system: 'System',
    tank: 'Tank Sensor',
    temperature: 'Temperature Sensor',
    vebus: 'VE.Bus System'
  }

  // Extract service type from path: com.victronenergy.{type}.{instance}
  const match = servicePath.match(/^com\.victronenergy\.([^.]+)/)
  if (match && match[1]) {
    const serviceType = match[1]
    return serviceTypeMap[serviceType] || serviceType
  }

  return servicePath
}

/**
 * Build grouped service dropdown options with optgroups
 * @param {Array} services - Array of service objects
 * @param {jQuery} $dropdown - jQuery dropdown element to populate
 * @returns {void}
 */
export function buildGroupedServiceDropdown (services, $dropdown) {
  // Group services by D-Bus service TYPE (not device name)
  const serviceGroups = {}
  services.forEach(function (service) {
    const serviceTypeName = getServiceTypeName(service.service)
    if (!serviceGroups[serviceTypeName]) {
      serviceGroups[serviceTypeName] = []
    }
    serviceGroups[serviceTypeName].push(service)
  })

  // Sort group names alphabetically
  const sortedGroupNames = Object.keys(serviceGroups).sort()

  // Clear dropdown
  $dropdown.empty()

  // Build optgroups
  sortedGroupNames.forEach(function (groupName) {
    const groupServices = serviceGroups[groupName]
    const hasMultipleDevices = groupServices.length > 1

    if (hasMultipleDevices) {
      // Create optgroup for multiple devices
      const $optgroup = $('<optgroup/>').attr('label', groupName)

      groupServices.forEach(function (service) {
        // Use device name for the option text
        const optionText = service.name + ' (' + service.deviceInstance + ')'
        const $option = $('<option/>')
          .val(service.service)
          .text(optionText)
          .data(service)
        $optgroup.append($option)
      })

      $dropdown.append($optgroup)
    } else {
      // Single device - no optgroup, use device name without instance
      const service = groupServices[0]
      const $option = $('<option/>')
        .val(service.service)
        .text(service.name)
        .data(service)
      $dropdown.append($option)
    }
  })
}

if (typeof window !== 'undefined') {
  window.__victronCommon = window.__victronCommon || {}
  window.__victronCommon.initializeTooltips = initializeTooltips
  window.__victronCommon.filterBlacklistedServices = filterBlacklistedServices
  window.__victronCommon.filterNumericPaths = filterNumericPaths
  window.__victronCommon.countServicesByName = countServicesByName
  window.__victronCommon.getServiceTypeName = getServiceTypeName
  window.__victronCommon.buildGroupedServiceDropdown = buildGroupedServiceDropdown
}
