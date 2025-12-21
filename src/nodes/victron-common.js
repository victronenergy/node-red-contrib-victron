/* global $ */

export function initializeTooltips() {

  $('.tooltip-container').remove()
  $('.tooltip-icon').off('mouseenter mouseleave')
  $('.tooltip-icon').on('mouseenter', function() {
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

  $('.tooltip-icon').on('mouseleave', function() {
    const $icon = $(this)
    const $tooltip = $icon.data('tooltip-element')
    if ($tooltip) {
      $tooltip.remove()
      $icon.removeData('tooltip-element')
    }
  })
}

if (typeof window !== 'undefined') {
  window.__victronCommon = window.__victronCommon || {}
  window.__victronCommon.initializeTooltips = initializeTooltips
}
