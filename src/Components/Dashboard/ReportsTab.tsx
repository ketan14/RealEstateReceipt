import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FinancialDashboardStats, OverdueMilestoneReport } from '../../types';

export const ReportsTab: React.FC = () => {
  const [stats, setStats] = useState<FinancialDashboardStats | null>(null);
  const [overdue, setOverdue] = useState<OverdueMilestoneReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [sRes, oRes] = await Promise.all([
        invoke<FinancialDashboardStats>('get_financial_dashboard_stats'),
        invoke<OverdueMilestoneReport[]>('get_overdue_milestones_report'),
      ]);
      setStats(sRes);
      setOverdue(oRes);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportCSV = () => {
    if (!stats) return;
    let csv = 'Project Name,Total Units,Booked Units,Agreed Value (INR),Collected (INR),Outstanding (INR)\n';
    stats.project_summaries.forEach((p) => {
      csv += `"${p.project_name}",${p.total_units},${p.booked_units},${p.total_agreed_value},${p.total_collected},${p.total_outstanding}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
        Loading Financial Analytics & Reports...
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-200">
            Executive Reporting & Financial Dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time financial performance, collection analytics, and overdue milestone tracking
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/30 text-xs flex items-center gap-2 transition-all"
        >
          📊 Export Revenue CSV
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 shadow">
          <div className="text-[10px] uppercase font-bold text-slate-500">Total Sales Revenue</div>
          <div className="text-xl font-extrabold text-slate-200 mt-1">₹{stats.total_revenue.toLocaleString('en-IN')}</div>
          <div className="text-xs font-semibold text-sky-400">{stats.booked_units} Units Booked</div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 shadow">
          <div className="text-[10px] uppercase font-bold text-slate-500">Cash Collections</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">₹{stats.total_collected.toLocaleString('en-IN')}</div>
          <div className="text-xs font-semibold text-emerald-400">
            {stats.total_revenue > 0 ? Math.round((stats.total_collected / stats.total_revenue) * 100) : 0}% Realized
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 shadow">
          <div className="text-[10px] uppercase font-bold text-slate-500">Outstanding Receivables</div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">₹{stats.total_outstanding.toLocaleString('en-IN')}</div>
          <div className="text-xs font-semibold text-amber-400">Pending Collections</div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 shadow">
          <div className="text-[10px] uppercase font-bold text-slate-500">Overdue Instalments</div>
          <div className="text-xl font-extrabold text-red-400 mt-1">₹{stats.overdue_amount.toLocaleString('en-IN')}</div>
          <div className="text-xs font-semibold text-red-400">{overdue.length} Milestones Overdue</div>
        </div>

        {/* Project Breakdown Table */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <h3 className="text-base font-bold text-slate-200 mb-4">Project-Wise Revenue & Absorption</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700">
                  <th className="px-3 py-2 text-left text-slate-400 font-bold">Project Name</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-bold">Units Sold / Total</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-bold">Agreed Revenue</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-bold">Collections</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-bold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {stats.project_summaries.map((p) => {
                  const absorptionPct = p.total_units > 0 ? Math.round((p.booked_units / p.total_units) * 100) : 0;
                  return (
                    <tr key={p.project_id} className="border-b border-slate-800">
                      <td className="px-3 py-3 font-bold text-slate-200">{p.project_name}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold">{p.booked_units} / {p.total_units}</span>
                        <span className="ml-2 text-xs text-slate-500">({absorptionPct}%)</span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-200">₹{p.total_agreed_value.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-400">₹{p.total_collected.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right font-bold text-amber-400">₹{p.total_outstanding.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Milestones Section */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-200">Overdue Payment Milestones</h3>
              <p className="text-xs text-slate-400">Installments past their due date requiring collection follow-up</p>
            </div>
            <span className="px-3 py-1 bg-red-950 text-red-300 border border-red-500/30 rounded-full text-xs font-bold">
              {overdue.length} Action Items
            </span>
          </div>

          {overdue.length === 0 ? (
            <div className="p-6 text-center text-emerald-400 text-sm font-semibold bg-emerald-950/40 rounded-md">
              🎉 Excellent! There are currently no overdue payment milestones.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="px-3 py-2 text-left text-slate-400">Customer</th>
                    <th className="px-3 py-2 text-left text-slate-400">Project & Unit</th>
                    <th className="px-3 py-2 text-left text-slate-400">Milestone</th>
                    <th className="px-3 py-2 text-left text-slate-400">Due Date</th>
                    <th className="px-3 py-2 text-right text-slate-400">Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((o) => (
                    <tr key={o.milestone_id} className="border-b border-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-200">{o.customer_name}</div>
                        <div className="text-xs text-slate-500">📞 {o.customer_phone}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-200">{o.project_name}</div>
                        <div className="text-xs text-slate-500">Unit {o.unit_number}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-200">{o.milestone_name}</td>
                      <td className="px-3 py-3 text-red-400 font-bold">{o.due_date}</td>
                      <td className="px-3 py-3 text-right font-extrabold text-red-400">
                        ₹{o.due_amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

};
