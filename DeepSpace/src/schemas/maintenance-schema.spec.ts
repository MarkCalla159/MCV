import { describe, expect, it } from 'vitest'
import { lintSchemaSet } from 'deepspace/worker'
import { schemas } from '../schemas'

describe('MaintenanceFlow schemas', () => {
  it('has no DeepSpace schema-lint warnings', () => {
    expect(lintSchemaSet(schemas)).toEqual([])
  })
})
