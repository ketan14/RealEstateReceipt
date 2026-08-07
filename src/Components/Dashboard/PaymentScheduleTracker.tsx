import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PaymentScheduleItem, PaymentMilestoneInput } from '../../types';
import { PaymentScheduleModal } from './PaymentScheduleModal';

interface PaymentScheduleTrackerProps {
  bookingId: number;
  agreedSaleValue: number;
}

export const PaymentScheduleTracker: React.FC<PaymentScheduleTrackerProps> = ({
  bookingId,
  agreedSaleValue,
}) => {
  const [items, setItems] = useState<PaymentScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await invoke<PaymentScheduleItem[]>('get_payment_schedule', { bookingId });
      setItems(res);
    } catch (err) {
      console.error('Failed to fetch schedule', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchSchedule();
    }
  }, [bookingId]);

  const handleStatusChange = async (milestoneId: number, newStatus: string) => {
    try {
      await invoke('update_milestone_status', { milestoneId, status: newStatus });
      fetchSchedule();
    } catch (err) {
      alert(`Error updating status: ${err}`);
    }
  };

  const handleSaveSchedule = async (milestones: PaymentMilestoneInput[]) => {
    try {
      await invoke('create_payment_schedule', { bookingId, milestones });
      fetchSchedule();
    } catch (err) {
      alert(`Error saving schedule: ${err}`);
    }
  };

  const totalDue = items.reduce((sum, item) => sum + item.due_amount, 0);
  const paidDue = items.filter(i => i.status === 'Paid').reduce((sum, item) => sum + item.due_amount, 0);
  const progressPct = totalDue > 0 ? Math.min(100, Math.round((paidDue / totalDue) * 100)) : 0;

  const getStatusBadge = (status: string, dueDate?: string | null) => {
    const isOverdue = status !== 'Paid' && dueDate && new Date(dueDate) < new Date();
    const displayStatus = isOverdue ? 'Overdue' : status;

    let bg = '#e2e8f0';
    let color = '#475569';
    if (displayStatus === 'Paid') { bg = '#dcfce7'; color = '#15803d'; }
    else if (displayStatus === 'Partially Paid') { bg = '#fef9c3'; color = '#a16207'; }
    else if (displayStatus === 'Overdue') { bg = '#fee2e2'; color = '#b91c1c'; }

    return (
      <span style={{
        padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
        fontWeight: 700, background: bg, color
      }}>
        {displayStatus}
      </span>
    );
  };

  if (loading) {
    return <div style={{ fontSize: '13px', color: '#64748b', padding: '12px 0' }}>Loading payment schedule...</div>;
  }

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Payment Milestones & Schedule</h4>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Scheduled Installment Milestones ({progressPct}% Complete)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '6px 14px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          {items.length === 0 ? '+ Add Schedule' : 'Edit Schedule'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #10b981)', transition: 'width 0.3s' }} />
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
          No installment milestones set for this booking yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.milestone_name} ({item.percentage}%)</div>
                {item.due_date && <div style={{ fontSize: '11px', color: '#64748b' }}>Due: {item.due_date}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>₹{item.due_amount.toLocaleString('en-IN')}</div>
                {getStatusBadge(item.status, item.due_date)}
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                  style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentScheduleModal
        isOpen={isModalOpen}
        agreedSaleValue={agreedSaleValue}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSchedule}
      />
    </div>
  );
};
