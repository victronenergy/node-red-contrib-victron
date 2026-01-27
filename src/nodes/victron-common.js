/* global $ */

// Service labels loaded from API
let serviceLabels = null

/**
 * Set service labels from API response
 * @param {Object} labels - Service labels object from API
 */
export function setServiceLabels (labels) {
  serviceLabels = labels
}

export function initializeTooltips () {
  $('.tooltip-container').remove()
  $('.tooltip-icon').off('mouseenter mouseleave')
  $('.tooltip-icon').on('mouseenter', function () {
    const $icon = $(this)
    const tooltipText = $icon.attr('data-tooltip')
    const $tooltip = $('<div class="tooltip-container"></div>').text(tooltipText)

    $('body').append($('<div class="victron-form"></div>').html($tooltip))

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
  // Extract service type from path: com.victronenergy.{type}/{instance}
  const match = servicePath.match(/^com\.victronenergy\.([^./]+)/)
  if (match && match[1]) {
    const serviceType = match[1]
    // Use API labels if available, with label property from object
    if (serviceLabels && serviceLabels[serviceType]) {
      return serviceLabels[serviceType].label || serviceType
    }
    return serviceType
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

  const sortedGroupNames = Object.keys(serviceGroups).sort(function (a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  $dropdown.empty()

  sortedGroupNames.forEach(function (groupName) {
    const groupServices = serviceGroups[groupName]

    groupServices.sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    const $optgroup = $('<optgroup/>').attr('label', groupName)
    const showInstance = groupServices.length > 1

    groupServices.forEach(function (service) {
      const optionText = showInstance
        ? service.name + ' (' + service.deviceInstance + ')'
        : service.name
      const $option = $('<option/>')
        .val(service.service)
        .text(optionText)
        .data(service)
      $optgroup.append($option)
    })

    $dropdown.append($optgroup)
  })
}

if (typeof window !== 'undefined') {
  window.__victronCommon = window.__victronCommon || {}
  window.__victronCommon.initializeTooltips = initializeTooltips
  window.__victronCommon.setServiceLabels = setServiceLabels
  window.__victronCommon.filterBlacklistedServices = filterBlacklistedServices
  window.__victronCommon.filterNumericPaths = filterNumericPaths
  window.__victronCommon.countServicesByName = countServicesByName
  window.__victronCommon.getServiceTypeName = getServiceTypeName
  window.__victronCommon.buildGroupedServiceDropdown = buildGroupedServiceDropdown
}
