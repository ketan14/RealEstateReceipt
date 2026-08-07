import React, { useState } from 'react';
import { PaymentMilestoneInput } from '../../types';

interface PaymentScheduleModalProps {
  isOpen: boolean;
  agreedSaleValue: number;
  onClose: () => void;
  onSave: (milestones: PaymentMilestoneInput[]) => void;
}

export const PaymentScheduleModal: React.FC<PaymentScheduleModalProps> = ({
  isOpen,
  agreedSaleValue,
  onClose,
  onSave,
}) => {
  const [milestones, setMilestones] = useState<PaymentMilestoneInput[]>([
    { milestone_name: 'Booking Amount', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: new Date().toISOString().split('T')[0] },
    { milestone_name: 'On Foundation / Plinth', percentage: 20, due_amount: Math.round(agreedSaleValue * 0.2), due_date: '' },
    { milestone_name: 'On Slab 1 Casting', percentage: 30, due_amount: Math.round(agreedSaleValue * 0.3), due_date: '' },
    { milestone_name: 'On Brickwork & Plaster', percentage: 30, due_amount: Math.round(agreedSaleValue * 0.3), due_date: '' },
    { milestone_name: 'On Possession / Handover', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: '' },
  ]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: 'CLP' | 'DP' | 'EQUAL') => {
    if (preset === 'DP') {
      // 10 : 80 : 10
      setMilestones([
        { milestone_name: 'Booking Amount (10%)', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: new Date().toISOString().split('T')[0] },
        { milestone_name: 'Bank Sanction / Disbursement (80%)', percentage: 80, due_amount: Math.round(agreedSaleValue * 0.8), due_date: '' },
        { milestone_name: 'On Possession (10%)', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: '' },
      ]);
    } else if (preset === 'CLP') {
      setMilestones([
        { milestone_name: 'Booking Amount (10%)', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: new Date().toISOString().split('T')[0] },
        { milestone_name: 'Foundation Level (15%)', percentage: 15, due_amount: Math.round(agreedSaleValue * 0.15), due_date: '' },
        { milestone_name: 'Superstructure Slab 1 (25%)', percentage: 25, due_amount: Math.round(agreedSaleValue * 0.25), due_date: '' },
        { milestone_name: 'Flooring & Plaster (25%)', percentage: 25, due_amount: Math.round(agreedSaleValue * 0.25), due_date: '' },
        { milestone_name: 'Finishing & OC (15%)', percentage: 15, due_amount: Math.round(agreedSaleValue * 0.15), due_date: '' },
        { milestone_name: 'Handover & Possession (10%)', percentage: 10, due_amount: Math.round(agreedSaleValue * 0.1), due_date: '' },
      ]);
    } else if (preset === 'EQUAL') {
      const step = Math.round(agreedSaleValue / 4);
      setMilestones([
        { milestone_name: 'Instalment 1 (25%)', percentage: 25, due_amount: step, due_date: new Date().toISOString().split('T')[0] },
        { milestone_name: 'Instalment 2 (25%)', percentage: 25, due_amount: step, due_date: '' },
        { milestone_name: 'Instalment 3 (25%)', percentage: 25, due_amount: step, due_date: '' },
        { milestone_name: 'Instalment 4 (25%)', percentage: 25, due_amount: step, due_date: '' },
      ]);
    }
  };

  const handleUpdateMilestone = (index: number, field: keyof PaymentMilestoneInput, val: any) => {
    const next = [...milestones];
    if (field === 'percentage') {
      const pct = parseFloat(val) || 0;
      next[index].percentage = pct;
      next[index].due_amount = Math.round(agreedSaleValue * (pct / 100));
    } else if (field === 'due_amount') {
      const amt = parseFloat(val) || 0;
      next[index].due_amount = amt;
      next[index].percentage = parseFloat(((amt / (agreedSaleValue || 1)) * 100).toFixed(2));
    } else {
      (next[index] as any)[field] = val;
    }
    setMilestones(next);
  };

  const handleAddRow = () => {
    setMilestones([
      ...milestones,
      { milestone_name: `Milestone ${milestones.length + 1}`, percentage: 0, due_amount: 0, due_date: '' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const totalPct = milestones.reduce((sum, m) => sum + m.percentage, 0);
  const totalAmt = milestones.reduce((sum, m) => sum + m.due_amount, 0);

  const handleSubmit = () => {
    onSave(milestones);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '780px',
        maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Define Payment Schedule</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
              Agreed Sale Value: <strong>₹{agreedSaleValue.toLocaleString('en-IN')}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Preset Templates */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', alignSelf: 'center' }}>Presets:</span>
          <button type="button" onClick={() => handleApplyPreset('CLP')} style={{ padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Construction-Linked (CLP)
          </button>
          <button type="button" onClick={() => handleApplyPreset('DP')} style={{ padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Down Payment (10:80:10)
          </button>
          <button type="button" onClick={() => handleApplyPreset('EQUAL')} style={{ padding: '6px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', color: '#6b21a8', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            4 Equal Instalments
          </button>
        </div>

        {/* Milestones Table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Milestone Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', width: '100px' }}>%</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', width: '140px' }}>Due Amount (₹)</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', width: '150px' }}>Due Date</th>
                <th style={{ padding: '10px 14px', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      value={m.milestone_name}
                      onChange={(e) => handleUpdateMilestone(idx, 'milestone_name', e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      value={m.percentage}
                      onChange={(e) => handleUpdateMilestone(idx, 'percentage', e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      value={m.due_amount}
                      onChange={(e) => handleUpdateMilestone(idx, 'due_amount', e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="date"
                      value={m.due_date || ''}
                      onChange={(e) => handleUpdateMilestone(idx, 'due_date', e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textIndent: 'center' }}>
                    <button type="button" onClick={() => handleRemoveRow(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button type="button" onClick={handleAddRow} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            + Add Milestone
          </button>
          <div style={{ fontSize: '13px', fontWeight: 700, color: totalPct === 100 ? '#16a34a' : '#dc2626' }}>
            Total: {totalPct}% (₹{totalAmt.toLocaleString('en-IN')}) {totalPct !== 100 && '⚠️ Should equal 100%'}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
};
