const { generateDocumentation, generateWildcardExplanation, highlightWildcards } = require('../scripts/service2doc.js')

describe('Service Documentation Generator', () => {
  const testServicesData = {
    switch: {
      help: {
        both: '<p>The <b>switch</b> node can be used for the usb-connected I/O extender.</p>',
        input: '',
        output: ' '
      },
      switch: [
        {
          path: '/SwitchableOutput/{type}/State',
          type: 'enum',
          enum: {
            '0': 'Off',
            '1': 'On'
          },
          name: '{type} state',
          mode: 'both'
        },
        {
          path: '/SwitchableOutput/{type}/Dimming',
          type: 'integer',
          name: '{type} dimming',
          mode: 'both'
        }
      ]
    }
  }

  test('generates wildcard explanation for HTML format', () => {
    const explanation = generateWildcardExplanation('nodered')
    
    expect(explanation).toContain('Wildcard Paths')
    expect(explanation).toContain('<code>{type}</code>')
    expect(explanation).toContain('Switch types (output_1, output_2')
    expect(explanation).toContain('<div class="wildcard-info"')
  })

  test('generates wildcard explanation for markdown format', () => {
    const explanation = generateWildcardExplanation('md')
    
    expect(explanation).toContain('**📝 Wildcard Paths:**')
    expect(explanation).toContain('`{type}`')
    expect(explanation).toContain('Switch types (output_1, output_2')
  })

  test('highlights wildcards in HTML format', () => {
    const text = 'Power for tracker {tracker} on phase {phase}'
    const highlighted = highlightWildcards(text, 'nodered')
    
    expect(highlighted).toContain('<code style="background-color: #e1f5fe')
    expect(highlighted).toContain('{tracker}')
    expect(highlighted).toContain('{phase}')
  })

  test('highlights wildcards in markdown format', () => {
    const text = 'Power for tracker {tracker} on phase {phase}'
    const highlighted = highlightWildcards(text, 'md')
    
    expect(highlighted).toContain('`{tracker}`')
    expect(highlighted).toContain('`{phase}`')
  })

  test('generates complete HTML documentation', () => {
    const registeredNodes = { inputNodes: new Set(['switch']), outputNodes: new Set(['switch']) }
    const doc = generateDocumentation(testServicesData, registeredNodes, 'nodered')

    expect(doc).toContain('data-help-name="victron-input-switch"')
    expect(doc).toContain('data-help-name="victron-output-switch"')
    expect(doc).toContain('Wildcard Paths')
    expect(doc).toContain('/SwitchableOutput/') // Check path structure
    expect(doc).toContain('<style>')
    expect(doc).toContain('{type}') // Check wildcard exists somewhere
  })

  test('generates complete markdown documentation', () => {
    const registeredNodes = { inputNodes: new Set(['switch']), outputNodes: new Set(['switch']) }
    const doc = generateDocumentation(testServicesData, registeredNodes, 'md')

    expect(doc).toContain('# Available Nodes')
    expect(doc).toContain('## Switch (input)')
    expect(doc).toContain('## Switch (output)')
    expect(doc).toContain('**📝 Wildcard Paths:**')
    expect(doc).toContain('`/SwitchableOutput/{type}/State`')
    expect(doc).toContain('**Type:** enum')
  })

  test('handles services without wildcards', () => {
    const simpleService = {
      battery: {
        help: { both: '<p>Battery node</p>' },
        battery: [
          {
            path: '/Dc/0/Voltage',
            type: 'float',
            name: 'Battery voltage (V DC)'
          }
        ]
      }
    }

    const registeredNodes = { inputNodes: new Set(['battery']), outputNodes: new Set() }
    const doc = generateDocumentation(simpleService, registeredNodes, 'nodered')

    expect(doc).toContain('Battery voltage (V DC)')
    expect(doc).toContain('/Dc/0/Voltage')
    expect(doc).not.toContain('Wildcard Paths')
  })
})
