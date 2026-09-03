import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Grid, List as ListIcon, Church } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchMinistries, fetchMinistryMemberCounts } from '@/services/ministries';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import type { Ministry } from '@/types/database';

type ViewMode = 'grid' | 'list';

const ministryColors = [
  { border: 'border-t-blue-600', bg: 'bg-blue-50', button: 'bg-blue-600 hover:bg-blue-700' },
  { border: 'border-t-green-600', bg: 'bg-green-50', button: 'bg-green-600 hover:bg-green-700' },
  { border: 'border-t-orange-600', bg: 'bg-orange-50', button: 'bg-orange-600 hover:bg-orange-700' },
  { border: 'border-t-purple-600', bg: 'bg-purple-50', button: 'bg-purple-600 hover:bg-purple-700' },
  { border: 'border-t-pink-600', bg: 'bg-pink-50', button: 'bg-pink-600 hover:bg-pink-700' },
  { border: 'border-t-indigo-600', bg: 'bg-indigo-50', button: 'bg-indigo-600 hover:bg-indigo-700' },
];

export function Ministries() {
  const { hasRole } = useAuth();
  const canManage = hasRole('administrator', 'secretary');
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  const memberCountsQuery = useQuery({ queryKey: ['ministry-member-counts'], queryFn: fetchMinistryMemberCounts });
  
  useRealtimeQuery('ministries', ['ministries']);
  useRealtimeQuery('ministry_members', ['ministry-member-counts']);

  const ministries = ministriesQuery.data ?? [];
  const memberCounts = memberCountsQuery.data ?? {};

  // Calculate stats
  const stats = useMemo(() => {
    const active = ministries.filter(m => m.is_active).length;
    return { total: ministries.length, active };
  }, [ministries]);

  // Filter ministries by search
  const filteredMinistries = useMemo(() => {
    if (!searchQuery) return ministries;
    const query = searchQuery.toLowerCase();
    return ministries.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.profiles?.full_name?.toLowerCase().includes(query)
    );
  }, [ministries, searchQuery]);

  // Get color for ministry based on index
  function getMinistryColor(index: number) {
    return ministryColors[index % ministryColors.length];
  }

  // Calculate events for 2025 (placeholder - would need actual event data)
  function getEventsCount(ministryId: string): number {
    // This would come from an actual events query filtered by ministry
    return Math.floor(Math.random() * 15) + 3; // Placeholder
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ministries</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} ministry groups · {stats.active} active
          </p>
        </div>
        {canManage && (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4" />
            Create Ministry
          </Button>
        )}
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search ministries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid view"
          >
            <Grid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            title="List view"
          >
            <ListIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Ministry Cards */}
      {ministriesQuery.isLoading ? (
        <Spinner />
      ) : filteredMinistries.length === 0 ? (
        <EmptyState 
          icon={Church} 
          title={searchQuery ? 'No ministries found' : 'No ministries yet'}
          description={searchQuery ? 'Try adjusting your search' : 'Create your first ministry to get started'}
        />
      ) : (
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1'
        }`}>
          {filteredMinistries.map((ministry, index) => {
            const colors = getMinistryColor(index);
            const memberCount = memberCounts[ministry.id] ?? 0;
            const eventsCount = getEventsCount(ministry.id);
            
            return (
              <div
                key={ministry.id}
                className={`bg-white rounded-xl border-2 border-slate-200 ${colors.border} border-t-4 overflow-hidden hover:shadow-lg transition-shadow`}
              >
                {/* Card Content */}
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Icon */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg}`}>
                        <Church className="h-6 w-6 text-slate-700" />
                      </div>
                      
                      {/* Title and Status */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">{ministry.name}</h3>
                        {ministry.is_active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {ministry.description || 'No description provided'}
                  </p>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Leader</span>
                      <span className="font-medium text-slate-900">
                        {ministry.profiles?.full_name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Members</span>
                      <span className="font-bold text-blue-600">{memberCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Events (2025)</span>
                      <span className="font-medium text-slate-900">{eventsCount}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                      View Details
                    </button>
                    <button className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${colors.button}`}>
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
