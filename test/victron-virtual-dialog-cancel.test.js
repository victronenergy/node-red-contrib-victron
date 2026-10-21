// test/victron-virtual-dialog-cancel.test.js
const { createEditDraft, applyEditDraft } = require('./fixtures/victron-virtual-functions.cjs')

describe('createEditDraft / applyEditDraft', () => {
  function createNode (values) {
    return {
      id: 'n1',
      x: 100,
      _def: { defaults: { name: { value: '' }, device: { value: '' }, enable_s2support: { value: false }, outputs: { value: 1 }, labels: { value: [] } } },
      ...values
    }
  }

  test('changes to the draft leave the node untouched', () => {
    const node = createNode({ device: 'acload', enable_s2support: false, outputs: 1, labels: ['a'] })
    const draft = createEditDraft(node)

    draft.enable_s2support = true
    draft.outputs = 2
    draft.labels.push('b')

    expect(node).toMatchObject({ enable_s2support: false, outputs: 1, labels: ['a'] })
  })

  test('applying writes the changed settings onto the node', () => {
    const node = createNode({ device: 'acload', enable_s2support: false, outputs: 1 })
    const draft = createEditDraft(node)
    draft.enable_s2support = true
    draft.outputs = 2

    applyEditDraft(node, draft)

    expect(node).toMatchObject({ device: 'acload', enable_s2support: true, outputs: 2 })
  })

  test('applying does not add settings the node does not have and the dialog left alone', () => {
    const node = createNode({ device: 'acload' })
    const draft = createEditDraft(node)

    applyEditDraft(node, draft)

    expect('enable_s2support' in node).toBe(false)
  })

  test('only covers the node defaults', () => {
    const node = createNode({ device: 'acload' })
    const draft = createEditDraft(node)

    expect(Object.keys(draft).sort()).toEqual(['device', 'enable_s2support', 'labels', 'name', 'outputs'])
  })
})
