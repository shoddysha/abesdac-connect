import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { format, differenceInDays } from 'date-fns';
import {
  BookOpen, CheckCircle2, Clock, Search,
  UserCheck, Users, Download, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { exportToCSV } from '@/utils/export';
import { logAudit } from '@/services/audit';
import type { Member } from '@/types/database';

type PipelineStage = 'all' | 'baptised' | 'unbaptised' | 'recent';

const STAGE_TABS: { value: PipelineStage; label: string; desc: string }[] = [
  { value: 'all',        label: 'All Members',       desc: 'Every active member' },
  { value: 'baptised',   label: 'Baptised',          desc: 'Have a baptism date recorded' },
  { value: 'unbaptised', label: 'Not Yet Baptised',  desc: 'No baptism date on record' },
  { value: 'recent',     label: 'Recent Baptisms',   desc: 'Baptised in the last 12 months' },
];

export function BaptismPipeline() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<PipelineStage>('all');
  const [search, setSearch] = useState('');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['baptism-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*, ministries(name)')
        .eq('is_archived', false)
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data as (Member & { ministries: { name: string } | null })[];
    },
  });

  const oneYearAgo = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);

  const filtered = useMemo(() => {
    let list = members;

    if (stage === 'baptised')   list = list.filter(m => !!m.baptism_date);
    if (stage === 'unbaptised') list = list.filter(m => !m.baptism_date);
    if (stage === 'recent')     list = list.filter(m =>
      m.baptism_date && new Date(m.baptism_date) >= oneYearAgo
    );

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.member_code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, stage, search, oneYearAgo]);

  const stats = useMemo(() => ({
    total:      members.length,
    baptised:   members.filter(m => !!m.baptism_date).length,
    unbaptised: members.filter(m => !m.baptism_date).length,
    recent:     members.filter(m => m.baptism_date && new Date(m.baptism_date) >= oneYearAgo).length,
  }), [members, oneYearAgo]);

  async function handleExport() {
    exportToCSV('baptism-pipeline', exportRows());
    await logAudit('export', 'baptism_pipeline', `Baptism pipeline exported (${filtered.length} members, filter: ${stage})`);
  }
    return filtered.map(m => ({
      'Member ID':     m.member_code,
      'First Name':    m.first_name,
      'Last Name':     m.last_name,
      'Baptism Date':  m.baptism_date ?? 'Not recorded',
      'Date Joined':   m.date_joined,
      'Ministry':      (m as any).ministries?.name ?? '—',
      'Phone':         m.phone ?? '—',
    }));
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Baptism Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track baptism status across active members
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Active',       value: stats.total,      icon: Users,        color: 'bg-blue-50 text-blue-600' },
          { label: 'Baptised',           value: stats.baptised,   icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Not Yet Baptised',   value: stats.unbaptised, icon: Clock,        color: 'bg-amber-50 text-amber-600' },
          { label: 'Baptised This Year', value: stats.recent,     icon: UserCheck,    color: 'bg-purple-50 text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2">
        {STAGE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStage(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              stage === tab.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ID…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No members found" description="Try adjusting your filters." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Ministry</th>
                  <th className="px-4 py-3 font-medium">Date Joined</th>
                  <th className="px-4 py-3 font-medium">Baptism Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => {
                  const isBaptised = !!m.baptism_date;
                  const isRecent = isBaptised && new Date(m.baptism_date!) >= oneYearAgo;
                  const daysSince = m.baptism_date
                    ? differenceInDays(new Date(), new Date(m.baptism_date))
                    : null;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/members/${m.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.member_code}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {(m as any).ministries?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {m.date_joined ? format(new Date(m.date_joined), 'd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {isBaptised
                          ? format(new Date(m.baptism_date!), 'd MMM yyyy')
                          : <span className="text-slate-400 italic text-xs">Not recorded</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {isBaptised ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isRecent
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            <CheckCircle2 className="h-3 w-3" />
                            {isRecent ? 'Recent' : `${daysSince}d ago`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            Showing {filtered.length} of {members.length} active members
          </div>
        </div>
      )}
    </div>
  );
}
