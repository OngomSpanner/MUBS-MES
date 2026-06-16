"use client";

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import CreateActivityModal from '@/components/Modals/CreateActivityModal';
import { Modal, Button, Form, Badge } from 'react-bootstrap';
import axios from 'axios';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { formatStandardProcessDuration, PROCESS_DURATION_UNIT_OPTIONS } from '@/lib/process-duration';
import { applyDefaultMilestonesToProcessRows } from '@/lib/milestone-progress-utils';
import { ACTIVITY_FY_TARGET_COLUMNS } from '@/lib/activity-fy-targets';
import {
  labelForActivityUnitOfMeasure,
  symbolForActivityUnitOfMeasure,
} from '@/lib/activity-unit-of-measure';
import { fyLabelForDateJulyJune, fyRangeJulyJune, formatFyRangeShort } from '@/lib/financial-year';
import { resolveRfPerformanceIndicator, resolveRfTargetValue } from '@/lib/rf-activity-targets';
import DepartmentUnitMultiSelect, { type DepartmentUnitOption } from '@/components/DepartmentUnitMultiSelect';
import { formatUserFeeDisplay } from '@/lib/standard-sds-fields';

function isUnassigned(a: { department_id?: number | null; department?: string }): boolean {
    return a.department_id == null || !a.department?.trim() || a.department === '-';
}

/** Table headers use global uppercase; show department names in normal casing (title-case if DB stored ALL CAPS). */
type StandardProcessFormRow = {
    step_name: string;
};

function emptyProcessRow(): StandardProcessFormRow {
    return { step_name: '' };
}

type StandardFormState = {
    standard_no: string;
    user_fee: string;
    title: string;
    standard_owner: string;
    supporting_units: string;
    pathway: string;
    quality_standard: string;
    output_standard: string;
    performance_indicators: string[];
    process_standard: string;
    time_standard: string;
    accessibility: string;
    coverage: string;
    frequency: string;
    target_beneficiary: string;
    access_criteria: string;
    methodology: string;
    inputs: string;
    duration_value: string;
    duration_unit: string;
    department_ids: number[];
    processes: StandardProcessFormRow[];
};

function emptyStandardForm(): StandardFormState {
    return {
        standard_no: '',
        user_fee: '',
        title: '',
        standard_owner: '',
        supporting_units: '',
        pathway: '',
        quality_standard: '',
        output_standard: '',
        performance_indicators: [''],
        process_standard: '',
        time_standard: '',
        accessibility: '',
        coverage: '',
        frequency: '',
        target_beneficiary: '',
        access_criteria: '',
        methodology: '',
        inputs: '',
        duration_value: '1',
        duration_unit: 'weeks',
        department_ids: [],
        processes: [emptyProcessRow()],
    };
}

function indicatorsFromStandard(std?: {
    performance_indicators?: string[];
    performance_indicator?: string | null;
}): string[] {
    if (Array.isArray(std?.performance_indicators) && std.performance_indicators.length > 0) {
        return [...std.performance_indicators];
    }
    const legacy = std?.performance_indicator;
    if (legacy != null && String(legacy).trim() !== '') {
        return String(legacy)
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [''];
}

function buildStandardDimensionsSummary(std: {
    quality_standard?: string | null;
    time_standard?: string | null;
    accessibility?: string | null;
    coverage?: string | null;
    frequency?: string | null;
}): string[] {
    const parts: string[] = [];
    if (std.quality_standard?.trim()) parts.push(`Quality: ${std.quality_standard.trim()}`);
    if (std.time_standard?.trim()) parts.push(`Time: ${std.time_standard.trim()}`);
    if (std.accessibility?.trim()) parts.push(`Accessibility: ${std.accessibility.trim()}`);
    if (std.coverage?.trim()) parts.push(`Coverage: ${std.coverage.trim()}`);
    if (std.frequency?.trim()) parts.push(`Frequency: ${std.frequency.trim()}`);
    return parts;
}

function standardIndicatorsList(std: {
    performance_indicators?: string[];
    performance_indicator?: string | null;
}): string[] {
    if (Array.isArray(std.performance_indicators) && std.performance_indicators.length > 0) {
        return std.performance_indicators;
    }
    if (std.performance_indicator != null && String(std.performance_indicator).trim() !== '') {
        return String(std.performance_indicator).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

function formatResponsibleOfficeLabel(name: string | undefined | null): string {
    if (name == null || name === '' || name === '-') return '—';
    const t = name.trim();
    if (!t) return '—';
    if (t !== t.toUpperCase()) return t;
    return t.split(/\s+/).map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');
}

function formatYmdShort(ymd: string | undefined | null): string {
    if (!ymd) return '—';
    const s = String(ymd).slice(0, 10);
    const d = new Date(`${s}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Delayed' }
];

function statusToLabel(s: string): string {
    const map: Record<string, string> = {
        pending: 'Not Started',
        in_progress: 'In Progress',
        completed: 'Completed',
        overdue: 'Delayed'
    };
    return map[s] ?? s;
}

interface Activity {
    id: number;
    row_key?: string;
    title: string;
    pillar: string;
    department: string;
    department_id: number | null;
    department_ids?: number[];
    faculty_office: string;
    target_kpi: string;
    start_date: string;
    end_date: string;
    progress: number;
    status: string;
    parent_id: number | null;
    parent_title?: string;
    strategic_objective: string;
    timeline: string;
    actual_value?: number;
    kpi_target_value?: number;
    standard_id?: number | null;
    quality_string?: string;
    output_string?: string;
    unit_of_measure?: string;
    target_fy25_26?: string | number | null;
    target_fy26_27?: string | number | null;
    target_fy27_28?: string | number | null;
    target_fy28_29?: string | number | null;
    target_fy29_30?: string | number | null;
}

export default function StrategicView() {
    const [activeSubTab, setActiveSubTab] = useState<'activities' | 'standards'>('standards');
    
    // -- Activities State --
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'reassign'>('create');
    
    // -- Standards State --
    const [standards, setStandards] = useState<any[]>([]);
    const [loadingStandards, setLoadingStandards] = useState(false);
    const [showStandardModal, setShowStandardModal] = useState(false);
    const [selectedStandard, setSelectedStandard] = useState<any>(null);
    const [savingStandard, setSavingStandard] = useState(false);
    const [loadingStandardModal, setLoadingStandardModal] = useState(false);
    const [standardForm, setStandardForm] = useState<StandardFormState>(emptyStandardForm);
    const [standardError, setStandardError] = useState<string | null>(null);
    const [standardSuccess, setStandardSuccess] = useState<string | null>(null);

    // -- Filters & Pagination --
    const [statusFilter, setStatusFilter] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('All Offices/Faculties');
    const [departmentFilter, setDepartmentFilter] = useState('All Departments/Units');
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentUnitOptions, setDepartmentUnitOptions] = useState<{ id: number; name: string }[]>([]);
    const [allDepartments, setAllDepartments] = useState<DepartmentUnitOption[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;
    
    const [stats, setStats] = useState({ total: 0, onTrack: 0, inProgress: 0, delayed: 0 });
    const [achievementStats, setAchievementStats] = useState<any[]>([]);
    const [themeStats, setThemeStats] = useState<any[]>([]);
    const [viewingStandardDetails, setViewingStandardDetails] = useState<any>(null);
    const [loadingStandardDetails, setLoadingStandardDetails] = useState(false);

    useEffect(() => {
        fetchActivities();
        fetchStats();
        loadDepartments();
        fetchStandards();
    }, []);

    const loadDepartments = async () => {
        try {
            const response = await axios.get('/api/departments');
            const list = Array.isArray(response.data) ? response.data : [];
            setAllDepartments(list);
            setDepartmentUnitOptions(list.filter((d: { parent_id: number | null }) => d.parent_id != null));
        } catch (e) { console.error('Error loading departments', e); }
    };

    const fetchActivities = async () => {
        setLoadingActivities(true);
        try {
            const response = await axios.get('/api/activities');
            const data = Array.isArray(response.data) ? response.data : [];
            setActivities(data);

            const themes: Record<string, { goals: number, achieved: number }> = {};
            data.forEach(a => {
                const pillar = a.pillar || 'Unassigned';
                if (!themes[pillar]) themes[pillar] = { goals: 0, achieved: 0 };
                themes[pillar].goals++;
                if (a.status === 'completed') themes[pillar].achieved++;
            });
            setThemeStats(Object.entries(themes).map(([name, val]) => ({ name, ...val })));

            let met = 0, partial = 0, notMet = 0;
            data.forEach(a => {
                if (a.status === 'completed') met++;
                else if (a.status === 'in_progress') partial++;
                else notMet++;
            });
            setAchievementStats([
                { name: 'Met', value: met, color: '#10b981' },
                { name: 'Partial', value: partial, color: '#f59e0b' },
                { name: 'Not Met', value: notMet, color: '#ef4444' },
            ]);
        } catch (error) {
            console.error('Error fetching activities:', error);
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    const fetchStandards = async () => {
        setLoadingStandards(true);
        try {
            const response = await axios.get('/api/standards');
            setStandards(Array.isArray(response.data) ? response.data : []);
        } catch (e) { console.error('Error fetching standards', e); }
        finally { setLoadingStandards(false); }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get('/api/dashboard/stats');
            setStats({
                total: response.data.stats.totalActivities || 0,
                onTrack: response.data.stats.onTrackActivities || 0,
                inProgress: response.data.stats.inProgressActivities || 0,
                delayed: response.data.stats.delayedActivities || 0
            });
        } catch (e) { console.error(e); }
    };

    const searchLower = searchQuery.trim().toLowerCase();
    const filteredActivities = activities.filter(a => {
        const matchStatus = !statusFilter || a.status === statusFilter;
        const matchDept = departmentFilter === 'All Departments/Units' || a.department === departmentFilter;
        const matchFaculty = facultyFilter === 'All Offices/Faculties' || a.faculty_office === facultyFilter;
        const matchSearch = !searchLower || (a.title && a.title.toLowerCase().includes(searchLower)) || (a.pillar && a.pillar.toLowerCase().includes(searchLower));
        return matchStatus && matchDept && matchFaculty && matchSearch;
    });

    const filteredStandards = standards.filter(s => 
        !searchLower ||
        s.title.toLowerCase().includes(searchLower) ||
        (s.standard_no && s.standard_no.toLowerCase().includes(searchLower)) ||
        (s.quality_standard && s.quality_standard.toLowerCase().includes(searchLower)) ||
        (s.standard_owner && s.standard_owner.toLowerCase().includes(searchLower)) ||
        (s.department_names || []).some((name: string) => name.toLowerCase().includes(searchLower))
    );

    const totalPages = Math.max(1, Math.ceil((activeSubTab === 'activities' ? filteredActivities.length : filteredStandards.length) / PAGE_SIZE));
    const paginatedActivities = filteredActivities.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const paginatedStandards = filteredStandards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [statusFilter, departmentFilter, facultyFilter, searchQuery, activeSubTab]);

    const openActivityModal = (mode: 'create' | 'edit' | 'reassign', activity?: Activity) => {
        setModalMode(mode);
        setSelectedActivity(activity ?? null);
        setShowCreateModal(true);
    };

    const [showViewStandardModal, setShowViewStandardModal] = useState(false);
    const [viewStandardDetails, setViewStandardDetails] = useState<any | null>(null);

    const applyStandardToForm = (std?: any) => {
        setSelectedStandard(std || null);
        if (!std) {
            setStandardForm(emptyStandardForm());
            return;
        }
        setStandardForm({
            standard_no: std.standard_no || '',
            user_fee: std.user_fee || '',
            title: std.title || '',
            standard_owner: std.standard_owner || '',
            supporting_units: std.supporting_units || '',
            pathway: std.pathway || '',
            quality_standard: std.quality_standard || '',
            output_standard: std.output_standard || '',
            performance_indicators: indicatorsFromStandard(std),
            process_standard: std.process_standard || '',
            time_standard: std.time_standard || '',
            accessibility: std.accessibility || '',
            coverage: std.coverage || '',
            frequency: std.frequency || '',
            target_beneficiary: std.target_beneficiary || '',
            access_criteria: std.access_criteria || '',
            methodology: std.methodology || '',
            inputs: std.inputs || '',
            duration_value:
                std.duration_value != null && std.duration_value !== ''
                    ? String(std.duration_value)
                    : '1',
            duration_unit:
                typeof std.duration_unit === 'string' && std.duration_unit.trim()
                    ? String(std.duration_unit).trim().toLowerCase()
                    : 'weeks',
            department_ids: Array.isArray(std.department_ids)
                ? std.department_ids.map((id: number) => Number(id)).filter((id: number) => Number.isFinite(id))
                : [],
            processes: std.processes?.length
                ? std.processes.map((p: any) => ({
                      step_name: p.step_name || '',
                  }))
                : [emptyProcessRow()],
        });
    };

    const openStandardModal = async (std?: any) => {
        // Open immediately with whatever we have, then refresh from API to avoid stale table-row state.
        setShowStandardModal(true);
        applyStandardToForm(std);
        if (!std?.id) return;
        setLoadingStandardModal(true);
        try {
            const res = await axios.get(`/api/standards/${std.id}?t=${Date.now()}`);
            applyStandardToForm(res.data);
        } catch (e) {
            console.error('Failed to refresh standard for edit modal', e);
        } finally {
            setLoadingStandardModal(false);
        }
    };

    const handleSaveStandard = async () => {
        setStandardError(null);
        setStandardSuccess(null);
        const standardNo = standardForm.standard_no.trim();
        const name = standardForm.title.trim();
        const owner = standardForm.standard_owner.trim();
        const output = standardForm.output_standard.trim();
        if (!standardNo) return setStandardError('Standard No. is required.');
        if (!name) return setStandardError('Standard title is required.');
        if (!owner) return setStandardError('Standard owner is required.');
        if (!output) return setStandardError('Output / service description is required.');
        const indicators = standardForm.performance_indicators.map((s) => s.trim()).filter(Boolean);
        if (indicators.length === 0) return setStandardError('Add at least one performance indicator.');
        const durCount = parseInt(String(standardForm.duration_value || ''), 10);
        if ((standardForm.duration_unit && (!Number.isFinite(durCount) || durCount < 1)) || (!standardForm.duration_unit && standardForm.duration_value)) {
            return setStandardError('If duration is set, include valid value (>= 1) and unit.');
        }
        const namedProcesses = standardForm.processes.filter((p) => p.step_name.trim());
        if (namedProcesses.length === 0) return setStandardError('At least one process task is required.');
        if (standardForm.department_ids.length === 0) {
            return setStandardError('Select at least one department or unit.');
        }
        const processesPayload = applyDefaultMilestonesToProcessRows(
            namedProcesses.map((p) => ({
                step_name: p.step_name.trim(),
                milestone_progress: '',
            }))
        ).map((p) => ({
            step_name: p.step_name,
            milestone_progress: Number(p.milestone_progress),
        }));
        setSavingStandard(true);
        try {
            const payload = {
                standard_no: standardNo,
                user_fee: standardForm.user_fee.trim() || null,
                title: name,
                standard_owner: owner,
                supporting_units: standardForm.supporting_units.trim() || null,
                pathway: standardForm.pathway.trim() || null,
                quality_standard: standardForm.quality_standard.trim() || null,
                output_standard: output,
                performance_indicators: indicators,
                process_standard: standardForm.process_standard.trim() || null,
                time_standard: standardForm.time_standard.trim() || null,
                accessibility: standardForm.accessibility.trim() || null,
                coverage: standardForm.coverage.trim() || null,
                frequency: standardForm.frequency.trim() || null,
                target_beneficiary: standardForm.target_beneficiary.trim() || null,
                access_criteria: standardForm.access_criteria.trim() || null,
                methodology: standardForm.methodology.trim() || null,
                inputs: standardForm.inputs.trim() || null,
                duration_value: durCount,
                duration_unit: standardForm.duration_unit,
                department_ids: standardForm.department_ids,
                processes: processesPayload,
            };
            if (selectedStandard) {
                await axios.put(`/api/standards/${selectedStandard.id}`, payload);
            } else {
                await axios.post('/api/standards', payload);
            }
            setStandardSuccess('Standard saved successfully!');
            setTimeout(() => {
                setShowStandardModal(false);
                setStandardSuccess(null);
            }, 1000);
            fetchStandards();
        } catch (e: unknown) {
            console.error(e);
            const msg =
                axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { message?: string }).message === 'string'
                    ? (e.response.data as { message: string }).message
                    : 'Failed to save standard';
            setStandardError(msg);
        } finally { setSavingStandard(false); }
    };

    const handleDeleteStandard = async (std: any) => {
        if (!confirm(`Delete standard "${std.title}"?`)) return;
        try {
            await axios.delete(`/api/standards/${std.id}`);
            fetchStandards();
        } catch (e) { console.error(e); alert('Failed to delete standard'); }
    };

    const handleDeleteActivity = async (activity: Activity) => {
        if (!confirm(`Delete activity "${activity.title}"? This removes the activity and any department copies linked to it.`)) return;
        try {
            await axios.delete(`/api/activities/${activity.id}`);
            setShowViewModal(false);
            setSelectedActivity(null);
            setViewingStandardDetails(null);
            fetchActivities();
            fetchStats();
        } catch (e) {
            console.error(e);
            alert('Failed to delete activity');
        }
    };

    const sortStandardProcesses = (std: any) => {
        const processes = Array.isArray(std?.processes) ? [...std.processes] : [];
        processes.sort((a: any, b: any) => {
            const ao = Number(a?.step_order ?? a?.task_order ?? 0);
            const bo = Number(b?.step_order ?? b?.task_order ?? 0);
            if (ao !== bo) return ao - bo;
            return String(a?.step_name ?? '').localeCompare(String(b?.step_name ?? ''), undefined, { sensitivity: 'base' });
        });
        return { ...std, processes };
    };

    const openViewStandard = async (std: any) => {
        setShowViewStandardModal(true);
        setViewStandardDetails(sortStandardProcesses(std));
        if (!std?.id) return;
        try {
            const res = await axios.get(`/api/standards/${std.id}?t=${Date.now()}`);
            setViewStandardDetails(sortStandardProcesses(res.data));
        } catch (e) {
            console.error('Failed to refresh standard for details modal', e);
        }
    };

    const openViewModal = async (activity: Activity) => {
        setSelectedActivity(activity);
        setShowViewModal(true);
        if (activity.standard_id) {
            setLoadingStandardDetails(true);
            try {
                const res = await fetch(`/api/standards/${activity.standard_id}`).then(r => r.json());
                if (!res.message) setViewingStandardDetails(res);
            } catch (e) { console.error(e); }
            finally { setLoadingStandardDetails(false); }
        } else {
            setViewingStandardDetails(null);
        }
    };

    const handleProcessPaste = (e: React.ClipboardEvent, index: number) => {
        const pasteData = e.clipboardData.getData('text');
        if (pasteData.includes('\n')) {
            e.preventDefault();
            const newLines = pasteData.split('\n').map(s => s.trim()).filter(s => s !== '');
            if (newLines.length > 0) {
                const arr = [...standardForm.processes];
                arr[index] = { ...emptyProcessRow(), step_name: newLines[0] };
                if (newLines.length > 1) {
                    const toInsert = newLines.slice(1).map((s) => ({ ...emptyProcessRow(), step_name: s }));
                    arr.splice(index + 1, 0, ...toInsert);
                }
                setStandardForm({
                    ...standardForm,
                    processes: arr,
                });
            }
        }
    };

    const addProcessRow = () => {
        setStandardForm({
            ...standardForm,
            processes: [...standardForm.processes, emptyProcessRow()],
        });
    };

    const removeProcessRow = (idx: number) => {
        setStandardForm({
            ...standardForm,
            processes: standardForm.processes.filter((_, i) => i !== idx),
        });
    };

    const addIndicatorRow = () => {
        setStandardForm({
            ...standardForm,
            performance_indicators: [...standardForm.performance_indicators, ''],
        });
    };

    const removeIndicatorRow = (idx: number) => {
        const next = standardForm.performance_indicators.filter((_, i) => i !== idx);
        setStandardForm({
            ...standardForm,
            performance_indicators: next.length > 0 ? next : [''],
        });
    };

    const updateIndicatorRow = (idx: number, value: string) => {
        const arr = [...standardForm.performance_indicators];
        arr[idx] = value;
        setStandardForm({ ...standardForm, performance_indicators: arr });
    };

    return (
        <Layout>
            {/* Summary Charts Row */}
            <div className="row g-4 mb-4">
                <div className="col-12 col-md-9">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: '#3b82f6' }}>query_stats</span>
                                Goals by Strategic Theme
                            </h5>
                        </div>
                        <div className="p-4" style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={themeStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                    <Legend verticalAlign="top" height={36} align="center" iconType="circle" />
                                    <Bar dataKey="goals" name="Goals" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                                    <Bar dataKey="achieved" name="Achieved" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-3">
                    <div className="table-card p-0 h-100">
                        <div className="table-card-header">
                            <h5>
                                <span className="material-symbols-outlined me-2" style={{ color: '#f59e0b' }}>donut_large</span>
                                Target Achievement
                            </h5>
                        </div>
                        <div className="p-4 d-flex flex-column align-items-center justify-content-center" style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                    <Pie data={achievementStats} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                        {achievementStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
                                {achievementStats.map((item, i) => (
                                    <div key={i} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab switcher — Standards first, activities second */}
            <div className="d-flex mb-4 gap-2 border-bottom pb-2">
                <button 
                    className={`btn btn-sm ${activeSubTab === 'standards' ? 'btn-primary' : 'btn-light'}`}
                    onClick={() => setActiveSubTab('standards')}
                    style={{ borderRadius: '8px', fontWeight: '600' }}
                >
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '18px', verticalAlign: 'middle' }}>rule</span>
                    Standards & Processes
                </button>
                <button 
                    className={`btn btn-sm ${activeSubTab === 'activities' ? 'btn-primary' : 'btn-light'}`}
                    onClick={() => setActiveSubTab('activities')}
                    style={{ borderRadius: '8px', fontWeight: '600' }}
                >
                    <span className="material-symbols-outlined me-1" style={{ fontSize: '18px', verticalAlign: 'middle' }}>track_changes</span>
                    Strategic Plan Activities
                </button>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h5>
                        <span className="material-symbols-outlined me-2" style={{ color: 'var(--mubs-blue)' }}>
                            {activeSubTab === 'activities' ? 'track_changes' : 'rule'}
                        </span>
                        {activeSubTab === 'activities' ? 'Strategic Plan Activities' : 'Standards & Process'}
                    </h5>
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                        <input
                            type="search"
                            className="form-control form-control-sm"
                            placeholder="Search…"
                            style={{ width: '160px' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {activeSubTab === 'activities' && (
                            <>
                                <select className="form-select form-select-sm" style={{ width: '160px' }} value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                                    <option value="All Departments/Units">All Departments</option>
                                    {departmentUnitOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                                <select className="form-select form-select-sm" style={{ width: '140px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <button className="btn btn-sm create-btn" onClick={() => openActivityModal('create')}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> New Activity
                                </button>
                            </>
                        )}
                        {activeSubTab === 'standards' && (
                            <button className="btn btn-sm create-btn" onClick={() => openStandardModal()}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> New Standard
                            </button>
                        )}
                    </div>
                </div>
                <div className="table-responsive">
                    {activeSubTab === 'activities' ? (
                        <table className="table mb-0 strategic-activities-table">
                            <thead>
                                <tr>
                                    <th>Objective</th>
                                    <th>Pillar</th>
                                    <th>Activity Name</th>
                                    <th>FY targets</th>
                                    <th>Responsible office</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingActivities ? (
                                    <tr><td colSpan={6} className="text-center py-4"><span className="spinner-border spinner-border-sm text-primary"></span> Loading...</td></tr>
                                ) : paginatedActivities.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-4 text-muted">No activities found</td></tr>
                                ) : (
                                    paginatedActivities.map((activity) => (
                                        <tr key={activity.row_key ?? activity.id}>
                                            <td style={{ fontSize: '.8rem', maxWidth: '120px' }} className="text-truncate" title={activity.strategic_objective}>{activity.strategic_objective || '-'}</td>
                                            <td style={{ fontSize: '.8rem' }}>{activity.pillar || '-'}</td>
                                            <td><div className="fw-normal text-dark" style={{ fontSize: '.82rem' }}>{activity.title}</div></td>
                                            <td style={{ fontSize: '.78rem', textTransform: 'none' }}>
                                                {ACTIVITY_FY_TARGET_COLUMNS.every(({ key }) => {
                                                    const v = activity[key as keyof Activity];
                                                    return v == null || v === '';
                                                })
                                                    ? '—'
                                                    : ACTIVITY_FY_TARGET_COLUMNS.map(({ key, label }) => {
                                                            const v = activity[key as keyof Activity];
                                                            if (v == null || v === '') return null;
                                                            return `${label.replace('FY ', '')}: ${String(v)}${symbolForActivityUnitOfMeasure(activity.unit_of_measure)}`;
                                                        })
                                                            .filter(Boolean)
                                                            .join(', ')}
                                            </td>
                                            <td style={{ fontSize: '.8rem', textTransform: 'none' }}>
                                                {formatResponsibleOfficeLabel(activity.department)}
                                                {isUnassigned(activity) && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.6rem' }}>Needs assignment</span>}
                                            </td>
                                            <td className="text-end pe-4">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 text-nowrap"
                                                    style={{ borderRadius: '8px', fontSize: '.8rem', whiteSpace: 'nowrap' }}
                                                    onClick={() => openViewModal(activity)}
                                                >
                                                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>visibility</span>
                                                    <span>View details</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="table mb-0 align-middle">
                            <thead>
                                <tr>
                                    <th className="ps-4">Standard No.</th>
                                    <th>Standard Title</th>
                                    <th>Department/Unit</th>
                                    <th>Processes</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingStandards ? (
                                    <tr><td colSpan={5} className="text-center py-4"><span className="spinner-border spinner-border-sm text-primary"></span> Loading...</td></tr>
                                ) : paginatedStandards.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-4 text-muted">No standards defined. Create one to use as a template.</td></tr>
                                ) : (
                                    paginatedStandards.map((s) => (
                                        <tr key={s.id}>
                                            <td className="ps-4">
                                                <code className="text-dark" style={{ fontSize: '0.72rem' }}>{s.standard_no || '—'}</code>
                                            </td>
                                            <td>
                                                <div className="text-dark" style={{ fontSize: '.86rem', fontWeight: 600 }}>{s.title}</div>
                                            </td>
                                            <td style={{ maxWidth: '280px' }}>
                                                {(s.department_names || []).length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {s.department_names.map((name: string) => (
                                                            <Badge
                                                                key={`${s.id}-${name}`}
                                                                bg="light"
                                                                className="text-dark border fw-normal"
                                                                style={{ fontSize: '0.65rem' }}
                                                            >
                                                                {name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                            <td><Badge bg="info-subtle" className="text-info border">{s.processes?.length || 0} process{(s.processes?.length || 0) === 1 ? '' : 'es'}</Badge></td>
                                            <td className="text-end pe-4">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 text-nowrap"
                                                    style={{ borderRadius: '8px', fontSize: '.8rem', whiteSpace: 'nowrap' }}
                                                    onClick={() => openViewStandard(s)}
                                                >
                                                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>visibility</span>
                                                    <span>View details</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="table-card-footer">
                    <span className="footer-label">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, activeSubTab === 'activities' ? filteredActivities.length : filteredStandards.length)} of {activeSubTab === 'activities' ? filteredActivities.length : filteredStandards.length} items
                    </span>
                    <div className="d-flex gap-1">
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button key={page} className={`page-btn ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                        ))}
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* View Standard Modal (read-only, mockup-style preview) */}
            <Modal
                show={showViewStandardModal && !!viewStandardDetails}
                onHide={() => setShowViewStandardModal(false)}
                centered
                scrollable
                size="xl"
                dialogClassName="modal-standard-preview"
            >
                <Modal.Header closeButton className="modal-standard-preview-header py-3">
                    <div>
                        <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-6 mb-0 text-white">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>visibility</span>
                            Standard details
                        </Modal.Title>
                        <p className="modal-standard-preview-subtitle mb-0">Read-only summary</p>
                    </div>
                </Modal.Header>
                {viewStandardDetails && (
                    <Modal.Body className="modal-standard-preview-body">
                        <div className="standard-preview-hero">
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Standard id:</span>
                                <span className="standard-preview-code">{viewStandardDetails.standard_no || '—'}</span>
                            </div>
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Standard title:</span>
                                <span className="standard-preview-meta-value"><strong>{viewStandardDetails.title}</strong></span>
                            </div>
                        </div>

                        <div className="standard-preview-overview">
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Standard owner:</span>
                                <span className="standard-preview-meta-value">{viewStandardDetails.standard_owner || '—'}</span>
                            </div>
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Supporting units:</span>
                                <span className="standard-preview-meta-value">{viewStandardDetails.supporting_units || '—'}</span>
                            </div>
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">User fee:</span>
                                <span className="standard-preview-meta-value">{formatUserFeeDisplay(viewStandardDetails.user_fee)}</span>
                            </div>
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Duration:</span>
                                <span className="standard-preview-meta-value">
                                    {viewStandardDetails.duration_unit
                                        ? formatStandardProcessDuration(viewStandardDetails.duration_value, viewStandardDetails.duration_unit)
                                        : '—'}
                                </span>
                            </div>
                            <div className="standard-preview-meta-line">
                                <span className="standard-preview-meta-label">Department / Unit:</span>
                                <span className="standard-preview-meta-value">
                                    {(viewStandardDetails.department_names || []).length > 0 ? (
                                        <span className="standard-preview-dept-chips">
                                            {viewStandardDetails.department_names.map((name: string) => (
                                                <span key={name} className="standard-preview-dept-chip">{name}</span>
                                            ))}
                                        </span>
                                    ) : '—'}
                                </span>
                            </div>
                        </div>

                        <div className="standard-preview-section">
                            <h4>Delivery process</h4>
                            {viewStandardDetails.processes?.length ? (
                                <div className="standard-process-stepper">
                                    {viewStandardDetails.processes.map((p: any, idx: number) => (
                                        <div key={`${p?.id ?? 't'}-${idx}`} className="standard-process-step">
                                            {idx > 0 && <span className="standard-process-step-arrow">→</span>}
                                            <span className="standard-process-step-num">{idx + 1}</span>
                                            <span className="standard-process-step-label">{String(p.step_name ?? '').trim() || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="standard-preview-empty">No tasks defined.</p>
                            )}
                            {viewStandardDetails.process_standard?.trim() ? (
                                <div className="standard-process-timing-note">
                                    <strong>Process timing:</strong> {viewStandardDetails.process_standard}
                                </div>
                            ) : null}
                        </div>

                        <div className="standard-preview-section">
                            <h4>Service delivery (SDS matrix)</h4>
                            <div className="standard-preview-table-wrap">
                                <table className="standard-preview-table">
                                    <thead>
                                        <tr>
                                            <th>Output</th>
                                            <th>Performance indicators</th>
                                            <th>Standard</th>
                                            <th>Target beneficiary</th>
                                            <th>Access criteria</th>
                                            <th>Methodology</th>
                                            <th>Inputs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>{viewStandardDetails.output_standard || '—'}</td>
                                            <td>
                                                {standardIndicatorsList(viewStandardDetails).length > 0 ? (
                                                    <ul>
                                                        {standardIndicatorsList(viewStandardDetails).map((ind: string, i: number) => (
                                                            <li key={i}>{ind}</li>
                                                        ))}
                                                    </ul>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                {buildStandardDimensionsSummary(viewStandardDetails).length > 0 ? (
                                                    <div className="standard-dimensions-cell">
                                                        {viewStandardDetails.quality_standard?.trim() ? (
                                                            <div><strong>Quality:</strong> {viewStandardDetails.quality_standard}</div>
                                                        ) : null}
                                                        {viewStandardDetails.time_standard?.trim() ? (
                                                            <div><strong>Time:</strong> {viewStandardDetails.time_standard}</div>
                                                        ) : null}
                                                        {viewStandardDetails.accessibility?.trim() ? (
                                                            <div><strong>Accessibility:</strong> {viewStandardDetails.accessibility}</div>
                                                        ) : null}
                                                        {viewStandardDetails.coverage?.trim() ? (
                                                            <div><strong>Coverage:</strong> {viewStandardDetails.coverage}</div>
                                                        ) : null}
                                                        {viewStandardDetails.frequency?.trim() ? (
                                                            <div><strong>Frequency:</strong> {viewStandardDetails.frequency}</div>
                                                        ) : null}
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td>{viewStandardDetails.target_beneficiary || '—'}</td>
                                            <td>{viewStandardDetails.access_criteria || '—'}</td>
                                            <td className="standard-preview-pre">{viewStandardDetails.methodology || '—'}</td>
                                            <td className="standard-preview-pre">{viewStandardDetails.inputs || '—'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Modal.Body>
                )}
                <Modal.Footer className="modal-standard-preview-footer justify-content-between flex-wrap gap-2">
                    {viewStandardDetails && (
                        <div className="d-flex gap-2">
                            <Button
                                variant="primary"
                                onClick={() => {
                                    openStandardModal(viewStandardDetails);
                                    setShowViewStandardModal(false);
                                }}
                            >
                                Edit standard
                            </Button>
                            <Button
                                variant="outline-danger"
                                onClick={() => {
                                    handleDeleteStandard(viewStandardDetails);
                                    setShowViewStandardModal(false);
                                }}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Standard Modal */}
            <Modal
                show={showStandardModal}
                onHide={() => setShowStandardModal(false)}
                centered
                scrollable
                dialogClassName="modal-standard-edit"
            >
                <Modal.Header closeButton className="modal-header-mubs py-2">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-6 mb-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{selectedStandard ? 'edit_square' : 'add_circle'}</span>
                        {selectedStandard ? 'Edit Standard' : 'New Standard'}
                    </Modal.Title>
                </Modal.Header>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveStandard();
                    }}
                >
                <Modal.Body className="p-3">
                    {standardError && (
                        <div className="alert alert-danger py-2 px-3 mb-3 border-0 shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                            <span className="material-symbols-outlined fs-5">error</span>
                            {standardError}
                        </div>
                    )}
                    {standardSuccess && (
                        <div className="alert alert-success py-2 px-3 mb-3 border-0 shadow-sm d-flex align-items-center gap-2" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                            <span className="material-symbols-outlined fs-5">check_circle</span>
                            {standardSuccess}
                        </div>
                    )}
                    <div className="d-flex flex-column gap-3">
                        <div className="border rounded-3 p-3">
                            <h6 className="fw-bold text-primary small mb-3">1. Standard identity</h6>
                            <div className="row g-2">
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small mb-1">Standard No. <span className="text-danger">*</span></Form.Label>
                                    <Form.Control size="sm" type="text" required name="standard_no" placeholder="e.g. MUBS/P1/OBJ12/REG/S007" value={standardForm.standard_no} onChange={(e) => setStandardForm({ ...standardForm, standard_no: e.target.value })} />
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small mb-1">User fee</Form.Label>
                                    <Form.Control size="sm" type="text" name="user_fee" placeholder="Leave blank if not applicable" value={standardForm.user_fee} onChange={(e) => setStandardForm({ ...standardForm, user_fee: e.target.value })} />
                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>Blank = Not Applicable</div>
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small mb-1">Duration</Form.Label>
                                    <div className="d-flex flex-wrap gap-2 align-items-center">
                                        <Form.Control type="number" min={1} size="sm" style={{ width: '90px' }} name="standard_duration_value" value={standardForm.duration_value} onChange={(e) => setStandardForm({ ...standardForm, duration_value: e.target.value })} required />
                                        <Form.Select size="sm" style={{ width: '140px' }} name="standard_duration_unit" value={standardForm.duration_unit} onChange={(e) => setStandardForm({ ...standardForm, duration_unit: e.target.value })} required>
                                            {PROCESS_DURATION_UNIT_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </Form.Select>
                                        <span className="text-muted small">{formatStandardProcessDuration(parseInt(String(standardForm.duration_value || '1'), 10), standardForm.duration_unit)}</span>
                                    </div>
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Standard title <span className="text-danger">*</span></Form.Label>
                                    <Form.Control size="sm" type="text" required name="standard_title" value={standardForm.title} onChange={(e) => setStandardForm({ ...standardForm, title: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Standard owner <span className="text-danger">*</span></Form.Label>
                                    <Form.Control size="sm" type="text" required name="standard_owner" placeholder="e.g. Office of the School Registrar" value={standardForm.standard_owner} onChange={(e) => setStandardForm({ ...standardForm, standard_owner: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Supporting units</Form.Label>
                                    <Form.Control size="sm" type="text" name="supporting_units" placeholder="Faculties, Departments, QAD, …" value={standardForm.supporting_units} onChange={(e) => setStandardForm({ ...standardForm, supporting_units: e.target.value })} />
                                </div>
                                <DepartmentUnitMultiSelect
                                    departments={allDepartments}
                                    selectedIds={standardForm.department_ids}
                                    onChange={(department_ids) => setStandardForm({ ...standardForm, department_ids })}
                                />
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Pathway (high-level flow)</Form.Label>
                                    <Form.Control size="sm" as="textarea" rows={2} name="pathway" value={standardForm.pathway} onChange={(e) => setStandardForm({ ...standardForm, pathway: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-3 p-3">
                            <h6 className="fw-bold text-primary small mb-3">2. Service delivery row (SDS matrix)</h6>
                            <div className="row g-2">
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Output / service description <span className="text-danger">*</span></Form.Label>
                                    <Form.Control size="sm" as="textarea" rows={2} required name="output_standard" value={standardForm.output_standard} onChange={(e) => setStandardForm({ ...standardForm, output_standard: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Performance indicators <span className="text-danger">*</span></Form.Label>
                                    <div className="d-flex flex-column gap-1">
                                        {standardForm.performance_indicators.map((ind, idx) => (
                                            <div key={idx} className="d-flex gap-2 align-items-center">
                                                <Form.Control size="sm" value={ind} onChange={(e) => updateIndicatorRow(idx, e.target.value)} placeholder={`Indicator ${idx + 1}`} />
                                                {standardForm.performance_indicators.length > 1 && (
                                                    <Button type="button" size="sm" variant="outline-danger" onClick={() => removeIndicatorRow(idx)}>×</Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" size="sm" variant="outline-primary" className="mt-2" onClick={addIndicatorRow}>+ Add indicator</Button>
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-2">Standard dimensions</Form.Label>
                                    <div className="row g-2">
                                        <div className="col-md-6">
                                            <Form.Label className="small text-muted mb-1">Quality</Form.Label>
                                            <Form.Control size="sm" as="textarea" rows={2} name="quality_standard" value={standardForm.quality_standard} onChange={(e) => setStandardForm({ ...standardForm, quality_standard: e.target.value })} />
                                        </div>
                                        <div className="col-md-6">
                                            <Form.Label className="small text-muted mb-1">Process (with time)</Form.Label>
                                            <Form.Control size="sm" as="textarea" rows={2} name="process_standard" value={standardForm.process_standard} onChange={(e) => setStandardForm({ ...standardForm, process_standard: e.target.value })} />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="small text-muted mb-1">Time / turnaround</Form.Label>
                                            <Form.Control size="sm" type="text" name="time_standard" value={standardForm.time_standard} onChange={(e) => setStandardForm({ ...standardForm, time_standard: e.target.value })} />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="small text-muted mb-1">Accessibility</Form.Label>
                                            <Form.Control size="sm" type="text" name="accessibility" value={standardForm.accessibility} onChange={(e) => setStandardForm({ ...standardForm, accessibility: e.target.value })} />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="small text-muted mb-1">Coverage</Form.Label>
                                            <Form.Control size="sm" type="text" name="coverage" value={standardForm.coverage} onChange={(e) => setStandardForm({ ...standardForm, coverage: e.target.value })} />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="small text-muted mb-1">Frequency</Form.Label>
                                            <Form.Control size="sm" type="text" name="frequency" value={standardForm.frequency} onChange={(e) => setStandardForm({ ...standardForm, frequency: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small mb-1">Target beneficiary</Form.Label>
                                    <Form.Control size="sm" type="text" name="target_beneficiary" value={standardForm.target_beneficiary} onChange={(e) => setStandardForm({ ...standardForm, target_beneficiary: e.target.value })} />
                                </div>
                                <div className="col-md-6">
                                    <Form.Label className="fw-bold small mb-1">Access criteria</Form.Label>
                                    <Form.Control size="sm" type="text" name="access_criteria" value={standardForm.access_criteria} onChange={(e) => setStandardForm({ ...standardForm, access_criteria: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Methodology for providing the service</Form.Label>
                                    <Form.Control size="sm" as="textarea" rows={3} name="methodology" value={standardForm.methodology} onChange={(e) => setStandardForm({ ...standardForm, methodology: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <Form.Label className="fw-bold small mb-1">Inputs</Form.Label>
                                    <Form.Control size="sm" as="textarea" rows={2} name="inputs" value={standardForm.inputs} onChange={(e) => setStandardForm({ ...standardForm, inputs: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-3 p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                <h6 className="fw-bold text-primary small mb-0">3. Process tasks</h6>
                                <Button type="button" size="sm" variant="outline-primary" onClick={addProcessRow}>+ Add task</Button>
                            </div>
                            <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                                List process tasks in order. Milestone progress is calculated automatically when you save.
                            </p>
                            <div className="d-flex flex-column gap-1">
                                {standardForm.processes.map((proc, idx) => (
                                    <div key={idx} className="border rounded p-2 py-1 bg-light bg-opacity-50">
                                        <div className="d-flex flex-nowrap align-items-center gap-2">
                                            <div className="bg-white border rounded-circle text-center small fw-bold flex-shrink-0" style={{ width: '26px', height: '26px', lineHeight: '24px', fontSize: '0.75rem' }} title={`Task ${idx + 1}`}>{idx + 1}</div>
                                            <Form.Control size="sm" className="flex-grow-1" style={{ minWidth: 0 }} required name={`process_${idx}_step_name`} value={proc.step_name} onChange={(e) => { const arr = [...standardForm.processes]; arr[idx].step_name = e.target.value; setStandardForm({ ...standardForm, processes: arr }); }} onPaste={(e) => handleProcessPaste(e, idx)} />
                                            <Button size="sm" variant="outline-danger" className="flex-shrink-0" onClick={() => removeProcessRow(idx)} title="Delete task">×</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="justify-content-end py-2">
                    <Button
                        type="submit"
                        size="sm"
                        style={{ backgroundColor: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                        disabled={savingStandard}
                    >
                        {savingStandard ? 'Saving...' : 'Save Standard'}
                    </Button>
                </Modal.Footer>
                </Form>
            </Modal>

            {/* Activity Create/Edit Modal */}
            <CreateActivityModal 
                show={showCreateModal} 
                onHide={() => setShowCreateModal(false)} 
                onActivityCreated={() => { fetchActivities(); fetchStats(); }} 
                activity={selectedActivity} 
                mode={modalMode} 
            />

            {/* Activity View Profile Modal */}
            {selectedActivity && showViewModal && (
                <Modal show={showViewModal} onHide={() => setShowViewModal(false)} centered dialogClassName="modal-standard-view">
                    <Modal.Header closeButton className="modal-header-mubs py-2">
                        <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-6 mb-0 text-white">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>analytics</span>
                            Activity profile
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3">
                        <div className="d-flex align-items-start justify-content-between gap-2">
                            <div style={{ minWidth: 0 }}>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                    Activity
                                </div>
                                <div className="fw-bold text-dark" style={{ fontSize: '1.05rem', lineHeight: 1.2, wordBreak: 'break-word' }}>
                                    {selectedActivity.title}
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                                    {selectedActivity.pillar} · {selectedActivity.faculty_office}
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <span
                                    className="badge text-uppercase"
                                    style={{
                                        padding: '.45rem .7rem',
                                        fontSize: '0.68rem',
                                        background:
                                            selectedActivity.status === 'completed'
                                                ? '#dcfce7'
                                                : selectedActivity.status === 'overdue'
                                                  ? '#fee2e2'
                                                  : '#fef9c3',
                                        color:
                                            selectedActivity.status === 'completed'
                                                ? '#15803d'
                                                : selectedActivity.status === 'overdue'
                                                  ? '#b91c1c'
                                                  : '#a16207',
                                        border: '1px solid rgba(148,163,184,.35)',
                                    }}
                                >
                                    {statusToLabel(selectedActivity.status)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 p-3 rounded-3 border" style={{ background: '#f8fafc' }}>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>target</span>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                    Objective
                                </div>
                            </div>
                            <div className="text-dark" style={{ fontSize: '0.85rem', lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
                                {selectedActivity.strategic_objective || '—'}
                            </div>
                        </div>

                        <div className="row g-2 mt-2">
                            <div className="col-12 col-md-6">
                                <div className="p-3 border rounded-3 h-100" style={{ background: '#f8fafc' }}>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>event</span>
                                        <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Start date
                                        </div>
                                    </div>
                                    <div className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>
                                        {formatYmdShort((selectedActivity as any).start_date)}
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-md-6">
                                <div className="p-3 border rounded-3 h-100" style={{ background: '#f8fafc' }}>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>event_busy</span>
                                        <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            End date
                                        </div>
                                    </div>
                                    <div className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>
                                        {formatYmdShort((selectedActivity as any).end_date)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const linkedStandard = standards.find((s) => s.id === selectedActivity.standard_id);
                            const rfRow = {
                                ...selectedActivity,
                                performance_indicator: linkedStandard?.performance_indicator ?? null,
                            };
                            const rfIndicator = resolveRfPerformanceIndicator(rfRow);
                            const rfTarget = resolveRfTargetValue(rfRow);
                            const currentFy = fyLabelForDateJulyJune();
                            return (
                                <div className="mt-3 p-3 rounded-3 border" style={{ background: '#f0f9ff' }}>
                                    <div className="fw-bold text-primary mb-2" style={{ fontSize: '0.85rem' }}>
                                        Results Framework
                                    </div>
                                    <div className="small mb-2">
                                        <span className="text-muted">Indicator:</span>{' '}
                                        <span className="text-dark">{rfIndicator || '—'}</span>
                                        {linkedStandard?.title ? (
                                            <span className="text-muted"> · from standard: {linkedStandard.title}</span>
                                        ) : null}
                                    </div>
                                    <div className="small">
                                        <span className="text-muted">Target ({currentFy}):</span>{' '}
                                        <span className="text-dark fw-semibold">
                                            {rfTarget != null ? rfTarget : '—'}
                                            {selectedActivity.unit_of_measure
                                                ? ` ${symbolForActivityUnitOfMeasure(selectedActivity.unit_of_measure)}`
                                                : ''}
                                        </span>
                                        {selectedActivity.actual_value != null ? (
                                            <span className="text-muted ms-2">
                                                · Actual: <strong className="text-dark">{selectedActivity.actual_value}</strong>
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="mt-3">
                            <div className="fw-bold text-primary mb-2" style={{ fontSize: '0.85rem' }}>
                                FY targets
                            </div>
                            <div className="table-responsive border rounded">
                                <table className="table table-sm table-bordered align-middle mb-0 small" style={{ fontSize: '0.78rem' }}>
                                    <thead className="table-light">
                                        <tr>
                                            {ACTIVITY_FY_TARGET_COLUMNS.map(({ key, label }) => (
                                                <th
                                                    key={key}
                                                    className="text-center text-nowrap px-2 py-2"
                                                    title={formatFyRangeShort(fyRangeJulyJune(label.replace('FY ', '')))}
                                                >
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {ACTIVITY_FY_TARGET_COLUMNS.map(({ key }) => {
                                                const v = selectedActivity[key as keyof Activity];
                                                const display = v != null && v !== '' ? String(v) : '—';
                                                return (
                                                    <td key={key} className="p-0 align-middle">
                                                        <div className="d-flex align-items-stretch">
                                                            <span className="flex-grow-1 text-center fw-medium py-2 px-1">
                                                                {display}
                                                            </span>
                                                            <span
                                                                className="d-flex align-items-center justify-content-center text-secondary border-start bg-light px-1 fw-bold user-select-none"
                                                                style={{ fontSize: '0.65rem', minWidth: '2rem', letterSpacing: '-0.02em' }}
                                                                title={labelForActivityUnitOfMeasure(selectedActivity.unit_of_measure)}
                                                            >
                                                                {symbolForActivityUnitOfMeasure(selectedActivity.unit_of_measure)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-3 p-3 rounded-3 border" style={{ background: '#f8fafc' }}>
                            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>bar_chart</span>
                                    <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                        Progress
                                    </div>
                                </div>
                                <div className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>
                                    {selectedActivity.progress}% 
                                </div>
                            </div>
                            <div className="progress" style={{ height: '10px', borderRadius: '6px' }}>
                                <div className="progress-bar" style={{ width: `${selectedActivity.progress}%`, background: '#10b981' }} />
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-top">
                            <div className="fw-bold text-primary mb-2" style={{ fontSize: '0.85rem' }}>
                                Linked standard
                            </div>
                                {loadingStandardDetails ? <div className="text-center py-3"><span className="spinner-border spinner-border-sm text-primary"></span></div> : viewingStandardDetails ? (
                                    <div className="row g-3">
                                        <div className="col-12">
                                            <div className="p-3 border rounded bg-light-subtle">
                                                <label className="fw-bold small text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Standard Title</label>
                                                <div className="small fw-semibold text-primary">{viewingStandardDetails.title || '—'}</div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 border rounded h-100 bg-light-subtle">
                                                <label className="fw-bold small text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Quality Standard</label>
                                                <div className="small">{viewingStandardDetails.quality_standard || '—'}</div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 border rounded h-100 bg-light-subtle">
                                                <label className="fw-bold small text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Expected Output</label>
                                                <div className="small">{viewingStandardDetails.output_standard || '—'}</div>
                                            </div>
                                        </div>
                                        {viewingStandardDetails.performance_indicator ? (
                                            <div className="col-12">
                                                <div className="p-3 border rounded bg-light-subtle">
                                                    <label className="fw-bold small text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>
                                                        Performance indicator
                                                    </label>
                                                    <div className="small">{viewingStandardDetails.performance_indicator}</div>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="col-12">
                                            <label className="fw-bold small text-muted text-uppercase d-block mb-2">Process</label>
                                            {viewingStandardDetails.processes?.length > 0 ? (
                                                <div className="d-flex flex-column gap-2">
                                                    {viewingStandardDetails.processes.map((proc: any, idx: number) => (
                                                        <div key={idx} className="small">
                                                            <div className="d-flex gap-2 flex-wrap align-items-baseline">
                                                                <span className="text-primary fw-bold">{idx + 1}.</span>
                                                                <span className="fw-medium">{proc.step_name}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="small text-muted fst-italic">No processes defined.</div>}
                                        </div>
                                        {viewingStandardDetails.duration_unit ? (
                                            <div className="col-12">
                                                <div className="p-3 border rounded bg-light-subtle">
                                                    <label className="fw-bold small text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>
                                                        Process duration
                                                    </label>
                                                    <div className="small">
                                                        {formatStandardProcessDuration(viewingStandardDetails.duration_value, viewingStandardDetails.duration_unit)}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : <div className="alert alert-light border small">No standard linked to this activity.</div>}
                            </div>
                    </Modal.Body>
                    <Modal.Footer className="justify-content-end gap-2">
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (!selectedActivity) return;
                                setShowViewModal(false);
                                openActivityModal('edit', selectedActivity);
                            }}
                        >
                            Edit activity
                        </Button>
                        <Button
                            variant="outline-danger"
                            onClick={() => {
                                if (!selectedActivity) return;
                                handleDeleteActivity(selectedActivity);
                            }}
                        >
                            Delete
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </Layout>
    );
}
