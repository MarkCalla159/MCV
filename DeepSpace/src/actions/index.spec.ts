import { describe, expect, it } from 'vitest'
import { actions } from './index'

describe('MaintenanceFlow action registry', () => {
  it('exposes every domain command through the authenticated action route', () => {
    expect(Object.keys(actions)).toEqual(expect.arrayContaining([
      'ensureMyProfile', 'createAsset', 'updateAsset', 'archiveAsset', 'createWorkOrder',
      'assignWorkOrder', 'startWorkOrder', 'blockWorkOrder', 'resumeWorkOrder',
      'updateWorkChecklist', 'updateWorkSummary', 'submitWorkForReview',
      'returnWorkForChanges', 'approveWorkOrder', 'cancelWorkOrder', 'addOrderComment',
      'registerAttachment', 'authorizeAttachmentUpload', 'seedDemoWorkspace',
    ]))
  })
})
