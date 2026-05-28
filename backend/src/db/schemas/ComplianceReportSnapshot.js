'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ComplianceReportSnapshotSchema = new Schema(
  {
    snapshotId: { type: String, required: true, unique: true, index: true },
    reportType: { type: String, enum: ['compliance_evidence_package'], default: 'compliance_evidence_package', index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    generatedBy: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    checksum: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'compliance_report_snapshots',
  }
);

ComplianceReportSnapshotSchema.pre('updateOne', function () {
  throw new Error('Compliance snapshots are immutable');
});
ComplianceReportSnapshotSchema.pre('updateMany', function () {
  throw new Error('Compliance snapshots are immutable');
});

ComplianceReportSnapshotSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ComplianceReportSnapshot', ComplianceReportSnapshotSchema);

