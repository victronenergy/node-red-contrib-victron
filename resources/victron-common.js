var victronCommon = (function (exports) {
  'use strict';

  /* global $ */

  function initializeTooltips () {
    $('.tooltip-container').remove();
    $('.tooltip-icon').off('mouseenter mouseleave');
    $('.tooltip-icon').on('mouseenter', function () {
      const $icon = $(this);
      const tooltipText = $icon.attr('data-tooltip');
      const $tooltip = $('<div class="tooltip-container"></div>').text(tooltipText);

      $('body').append($('<div class="victron-form"></div>').html($tooltip));

      const iconOffset = $icon.offset();
      const tooltipHeight = $tooltip.outerHeight();
      const tooltipWidth = $tooltip.outerWidth();

      $tooltip.css({
        top: iconOffset.top - tooltipHeight - 8,
        left: iconOffset.left - (tooltipWidth / 2) + ($icon.outerWidth() / 2)
      });

      $icon.data('tooltip-element', $tooltip);
    });

    $('.tooltip-icon').on('mouseleave', function () {
      const $icon = $(this);
      const $tooltip = $icon.data('tooltip-element');
      if ($tooltip) {
        $tooltip.remove();
        $icon.removeData('tooltip-element');
      }
    });
  }

  /**
   * Filter services based on blacklist patterns
   * @param {Array} services - Array of service objects
   * @returns {Array} Filtered services
   */
  function filterBlacklistedServices (services) {
    const blacklist = [
      /^com\.victronenergy\.adc/,
      /^com\.victronenergy\.ble/,
      /^com\.victronenergy\.fronius/,
      /^com\.victronenergy\.modbusclient\.tcp/,
      /^com\.victronenergy\.shelly/,
      /^com\.victronenergy\.vecan\./
    ];

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
  function filterNumericPaths (paths) {
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
  function countServicesByName (services) {
    const counts = {};
    services.forEach(function (service) {
      counts[service.name] = (counts[service.name] || 0) + 1;
    });
    return counts
  }

  /**
   * Get friendly service type name from D-Bus service path
   * @param {string} servicePath - D-Bus service path (e.g., "com.victronenergy.tank.socketcan_can0_vi0_uc6536")
   * @returns {string} Friendly service type name (e.g., "Tank Sensor")
   */
  function getServiceTypeName (servicePath) {
    // Service type mapping (matches registerInputNode calls)
    const serviceTypeMap = {
      accharger: 'AC Charger',
      acload: 'AC Load',
      acsystem: 'AC System',
      alternator: 'Alternator',
      battery: 'Battery Monitor',
      dcdc: 'DC-DC',
      dcgenset: 'DC Generator',
      dcload: 'DC Load',
      dcsource: 'DC Source',
      dcsystem: 'DC System',
      dess: 'Dynamic ESS',
      digitalinput: 'Digital Input',
      ess: 'ESS',
      evcharger: 'EV Charger',
      fuelcell: 'Fuel Cell',
      generator: 'Generator',
      gps: 'GPS',
      grid: 'Grid Meter',
      gridmeter: 'Grid Meter',
      inverter: 'Inverter',
      meteo: 'Meteo',
      motordrive: 'Motor Drive',
      multi: 'Multi RS',
      pulsemeter: 'Pulse Meter',
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
    };

    // Extract service type from path: com.victronenergy.{type}/{instance}
    const match = servicePath.match(/^com\.victronenergy\.([^./]+)/);
    if (match && match[1]) {
      const serviceType = match[1];
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
  function buildGroupedServiceDropdown (services, $dropdown) {
    // Group services by D-Bus service TYPE (not device name)
    const serviceGroups = {};
    services.forEach(function (service) {
      const serviceTypeName = getServiceTypeName(service.service);
      if (!serviceGroups[serviceTypeName]) {
        serviceGroups[serviceTypeName] = [];
      }
      serviceGroups[serviceTypeName].push(service);
    });

    const sortedGroupNames = Object.keys(serviceGroups).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    });

    $dropdown.empty();

    sortedGroupNames.forEach(function (groupName) {
      const groupServices = serviceGroups[groupName];

      groupServices.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      });

      const $optgroup = $('<optgroup/>').attr('label', groupName);
      const showInstance = groupServices.length > 1;

      groupServices.forEach(function (service) {
        const optionText = showInstance
          ? service.name + ' (' + service.deviceInstance + ')'
          : service.name;
        const $option = $('<option/>')
          .val(service.service)
          .text(optionText)
          .data(service);
        $optgroup.append($option);
      });

      $dropdown.append($optgroup);
    });
  }

  if (typeof window !== 'undefined') {
    window.__victronCommon = window.__victronCommon || {};
    window.__victronCommon.initializeTooltips = initializeTooltips;
    window.__victronCommon.filterBlacklistedServices = filterBlacklistedServices;
    window.__victronCommon.filterNumericPaths = filterNumericPaths;
    window.__victronCommon.countServicesByName = countServicesByName;
    window.__victronCommon.getServiceTypeName = getServiceTypeName;
    window.__victronCommon.buildGroupedServiceDropdown = buildGroupedServiceDropdown;
  }

  exports.buildGroupedServiceDropdown = buildGroupedServiceDropdown;
  exports.countServicesByName = countServicesByName;
  exports.filterBlacklistedServices = filterBlacklistedServices;
  exports.filterNumericPaths = filterNumericPaths;
  exports.getServiceTypeName = getServiceTypeName;
  exports.initializeTooltips = initializeTooltips;

  return exports;

})({});
