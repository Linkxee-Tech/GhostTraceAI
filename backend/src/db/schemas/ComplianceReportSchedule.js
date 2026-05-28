'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ComplianceReportScheduleSchema = new Schema(
  {
    scheduleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    reportType: { type: String, enum: ['compliance_evidence_package'], default: 'compliance_evidence_package' },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    enabled: { type: Boolean, default: true, index: true },
    hourUtc: { type: Number, min: 0, max: 23, default: 0 },
    dayOfWeekUtc: { type: Number, min: 0, max: 6 },
    dayOfMonthUtc: { type: Number, min: 1, max: 31 },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date, index: true },
    recipients: [{ type: String }],
    createdBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'compliance_report_schedules' }
);

module.exports = mongoose.model('ComplianceReportSchedule', ComplianceReportScheduleSchema);

