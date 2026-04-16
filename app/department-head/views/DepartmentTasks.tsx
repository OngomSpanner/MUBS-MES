'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

import StatCard from '@/components/StatCard';
import DepartmentTaskCardGrid from '@/components/Department/DepartmentTaskCardGrid';
import EvaluateSubmissionModal, { parseEvidenceItems, type FeedbackHistoryEntry } from '@/components/Department/EvaluateSubmissionModal';
import { addDurationToStartDate, formatStandardProcessDuration } from '@/lib/process-duration';
import { PROCESS_REASSIGN_REASONS } from '@/lib/process-reassign-reasons';


interface Task {
    id: number;
    title: string;
    status: string;
    progress: number;
    dueDate: string;
    assignee_name: string;
    assigned_to?: number;
    assigned_to_ids?: number[];
    activity_title: string;
    activity_id?: number;
    strategic_activity_id?: number;
    description?: string;
    reviewer_notes?: string;
    kpi_target_value?: number | null;
    startDate?: string;
    endDate?: string;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
    frequency_interval?: number;
    task_type?: string;
    tier?: string;
    performance_indicator?: string | null;
    duration_value?: number | null;
    duration_unit?: string | null;
    source?: string | null;
}

type ProcessSubtask = {
    id: number;
    process_assignment_id: number;
    title: string;
    assigned_to: number;
    assigned_to_name: string;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
};

interface Evaluation {
    id: number;
    report_name: string;
    activity_title: string;
    staff_name: string;
    submitted_at: string;
    status: string;
    progress: number;
    report_summary: string;
    attachments?: string | null;
    score?: number;
    reviewer_notes?: string;
    task_type?: 'process' | 'kpi_driver';
    kpi_actual_value?: number | null;
}


interface KanbanData {
    kanban: {
        todo: Task[];
        inProgress: Task[];
        underReview: Task[];
        completed: Task[];
    };
    filters: {
        activities: string[];
        assignees: string[];
    };
}

/** Format date as YYYY-MM-DD in local time (avoids UTC rollover with date inputs) */
const toYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function titleCaseWord(word: string) {
    if (!word) return '';
    const w = word.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
}

/** First name for table cell; normalizes DB ALL-CAPS. */
function staffAssigneeShortLabel(fullName: string | undefined | null, unassignedLabel: string) {
    const raw = (fullName ?? '').trim();
    if (!raw) return unassignedLabel;
    const first = raw.split(/\s+/)[0] ?? '';
    return titleCaseWord(first);
}

/** Initials for avatar (uppercase is conventional). */
function staffAssigneeInitials(fullName: string | undefined | null) {
    const raw = (fullName ?? '').trim();
    if (!raw) return '?';
    return raw
        .split(/\s+/)
        .map((part) => (part.charAt(0) || '').toUpperCase())
        .join('');
}

function staffAssigneeTitle(fullName: string | undefined | null, unassignedLabel: string) {
    const raw = (fullName ?? '').trim();
    if (!raw) return unassignedLabel;
    return raw.split(/\s+/).map(titleCaseWord).join(' ');
}

interface DepartmentTasksProps {
    initialActivity?: string;
    initialAssignee?: string;
}

export default function DepartmentTasks({ initialActivity, initialAssignee }: DepartmentTasksProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const actionParam = searchParams.get('action');
    const hasAutoOpened = useRef(false);
    const [data, setData] = useState<KanbanData | null>(null);
    const [availableActivities, setAvailableActivities] = useState<{ 
        id: number, 
        title: string, 
        end_date?: string,
        start_date?: string,
        pillar?: string,
        actual_value?: number,
        kpi_target_value?: number,
        target_kpi?: string,
        status?: string
    }[]>([]);
    const [departmentUsers, setDepartmentUsers] = useState<{ id: number; full_name: string; position: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activityFilter, setActivityFilter] = useState(initialActivity || 'All Tasks');
    const [assigneeFilter, setAssigneeFilter] = useState(initialAssignee || 'All Assignees');
    const [activityIdFilter, setActivityIdFilter] = useState<number | null>(null);
    const [subtasksByProcessAssignmentId, setSubtasksByProcessAssignmentId] = useState<Record<number, ProcessSubtask[]>>({});
    const [expandedProcessAssignmentIds, setExpandedProcessAssignmentIds] = useState<Record<number, boolean>>({});

    const subtaskProgress = (rawStatus: string | null | undefined): number => {
        const s = String(rawStatus || '').toLowerCase();
        if (s === 'completed' || s === 'evaluated') return 100;
        if (s === 'submitted') return 50;
        if (s === 'in_progress') return 25;
        return 0;
    };

    const subtaskStatusBlocksReassign = (rawStatus: string | null | undefined): boolean => {
        const s = String(rawStatus || '').toLowerCase().trim();
        return s === 'completed' || s === 'evaluated';
    };

    const UNASSIGNED_LABEL = 'Unassigned';

    // Modal States
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'grid' | 'activity'>('activity');
    const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [statusFilter, setStatusFilter] = useState('All');
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
    const [activityProcessScope, setActivityProcessScope] = useState<'all' | 'strategic' | 'department'>('all');

    const [openProcessTask, setOpenProcessTask] = useState<Task | null>(null);
    const [openProcessStart, setOpenProcessStart] = useState('');
    const [openProcessSaving, setOpenProcessSaving] = useState(false);
    const [showBulkOpenModal, setShowBulkOpenModal] = useState(false);
    const [bulkOpenStart, setBulkOpenStart] = useState('');
    const [bulkOpenSaving, setBulkOpenSaving] = useState(false);
    const [feedbackHistoryForReview, setFeedbackHistoryForReview] = useState<FeedbackHistoryEntry[]>([]);

    const [reassignTask, setReassignTask] = useState<Task | null>(null);
    const [reassignStaffId, setReassignStaffId] = useState<number | ''>('');
    const [reassignReasonCode, setReassignReasonCode] = useState('');
    const [reassignDescription, setReassignDescription] = useState('');
    const [reassignSaving, setReassignSaving] = useState(false);

    type ReassignSubtaskCtx = {
        assignmentId: number;
        subtask: ProcessSubtask;
        parentProcessTitle: string;
        activityTitle: string;
    };
    const [reassignSubtaskCtx, setReassignSubtaskCtx] = useState<ReassignSubtaskCtx | null>(null);
    const [reassignSubtaskStaffId, setReassignSubtaskStaffId] = useState<number | ''>('');
    const [reassignSubtaskReasonCode, setReassignSubtaskReasonCode] = useState('');
    const [reassignSubtaskDescription, setReassignSubtaskDescription] = useState('');
    const [reassignSubtaskSaving, setReassignSubtaskSaving] = useState(false);

    /** Table view: row opens this modal with full-width action buttons */
    const [tableDetailsTask, setTableDetailsTask] = useState<Task | null>(null);
    const [tableDetailsReview, setTableDetailsReview] = useState<Evaluation | null>(null);
    const [tableDetailsReviewLoading, setTableDetailsReviewLoading] = useState(false);

    // Evaluation Modal States
    const [evaluateModalItem, setEvaluateModalItem] = useState<Evaluation | null>(null);
    const [viewModalItem, setViewModalItem] = useState<Evaluation | null>(null);
    const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
    const [selectedRating, setSelectedRating] = useState<{ [key: number]: 'Complete' | 'Incomplete' | 'Not Done' }>({});
    const [evaluationComments, setEvaluationComments] = useState<{ [key: number]: string }>({});
    const [kpiActualValues, setKpiActualValues] = useState<{ [key: number]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Message/Alert Modal State
    const [messageModal, setMessageModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        type: 'info' | 'error' | 'success' | 'warning';
    }>({ show: false, title: '', message: '', type: 'info' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    
    useEffect(() => {
        if (evaluateModalItem) {
            const id = evaluateModalItem.id;
            // Pre-populate KPI value from what staff entered if not already set locally
            if (evaluateModalItem.kpi_actual_value != null && kpiActualValues[id] === undefined) {
                setKpiActualValues(prev => ({ ...prev, [id]: String(evaluateModalItem.kpi_actual_value) }));
            }
        }
    }, [evaluateModalItem]);





    const fetchData = async () => {
        try {
            const [tasksRes, activitiesRes, usersRes, processAssignmentsRes] = await Promise.all([
                axios.get('/api/department-head/tasks'),
                axios.get('/api/department-head/activities').catch(() => ({ data: { activities: [] } })),
                axios.get('/api/users/department'),
                axios.get('/api/department-head/process-assignments').catch(() => ({ data: [] })),
            ]);
            const tasksData = tasksRes.data?.kanban ? tasksRes.data : {
                kanban: tasksRes.data?.kanban || { todo: [], inProgress: [], underReview: [], completed: [] },
                availableActivities: tasksRes.data?.availableActivities || [],
                filters: tasksRes.data?.filters || { activities: [], assignees: [] }
            };
            setData(tasksData);
            setDepartmentUsers(usersRes.data || []);

            // Subtasks map (container process assignments only)
            const paRows = Array.isArray(processAssignmentsRes.data) ? processAssignmentsRes.data : [];
            const map: Record<number, ProcessSubtask[]> = {};
            for (const row of paRows) {
                const pid = Number(row?.id);
                if (!Number.isFinite(pid) || pid <= 0) continue;
                const staffId = row?.staff_id;
                if (staffId != null && staffId !== '') continue; // only container rows
                const subs = Array.isArray(row?.subtasks) ? row.subtasks : [];
                map[pid] = subs
                    .map((s: any) => ({
                        id: Number(s.id),
                        process_assignment_id: Number(s.process_assignment_id),
                        title: String(s.title ?? ''),
                        assigned_to: Number(s.assigned_to),
                        assigned_to_name: String(s.assigned_to_name ?? ''),
                        status: String(s.status ?? ''),
                        start_date: s.start_date ?? null,
                        end_date: s.end_date ?? null,
                    }))
                    .filter((s: any) => Number.isFinite(s.id) && s.id > 0);
            }
            setSubtasksByProcessAssignmentId(map);

            // Merge parent activities from both APIs so we never miss one (same source of truth, but union in case of any mismatch)
            const activitiesList = Array.isArray(activitiesRes?.data?.activities) ? activitiesRes.data.activities : [];
            // Parent options exactly as they appear in the Activities table
            const parentsFromActivities = activitiesList;
            const fromTasks = Array.isArray(tasksRes.data?.availableActivities) ? tasksRes.data.availableActivities : [];
            const byId = new Map<number, { id: number; title: string, end_date?: string }>();
            parentsFromActivities.forEach((a: { id: number; title: string; end_date?: string }) => byId.set(a.id, { id: a.id, title: a.title, end_date: a.end_date }));
            fromTasks.forEach((a: { id: number; title: string; end_date?: string }) => { if (!byId.has(a.id)) byId.set(a.id, { id: a.id, title: a.title, end_date: a.end_date }); });
            
            const parentOptions = Array.from(byId.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            
            // Enrich parentOptions with full metadata from activitiesRes
            const enrichedOptions = parentOptions.map(opt => {
                const full = activitiesList.find((a: any) => a.id === opt.id);
                const fromT = fromTasks.find((a: any) => a.id === opt.id);
                return {
                    ...opt,
                    pillar: full?.pillar || (opt as any)?.pillar,
                    start_date: full?.start_date,
                    actual_value: full?.actual_value,
                    kpi_target_value: full?.kpi_target_value ?? fromT?.kpi_target_value,
                    target_kpi: full?.target_kpi || fromT?.target_kpi,
                    status: full?.status
                };
            });

            setAvailableActivities(enrichedOptions);
        } catch (error: any) {
            console.error('Error fetching department tasks data:', error);
            setError(error.response?.data?.message || 'Failed to load tasks data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Sync state with URL parameters to enable browser back/forward navigation
    useEffect(() => {
        const mode = searchParams.get('mode') as 'table' | 'grid' | 'activity' | null;
        const activity = searchParams.get('activity');
        const activityIdRaw = searchParams.get('activityId');
        const status = searchParams.get('status');

        if (mode && ['table', 'grid', 'activity'].includes(mode)) {
            setViewMode(mode);
        } else {
            // Default to activity if mode is missing or invalid (matches Hub view)
            setViewMode('activity');
        }

        if (activity) {
            setActivityFilter(activity);
        } else if (mode === 'activity' || !mode) {
            setActivityFilter('All Tasks');
        }

        if (activityIdRaw && String(activityIdRaw).trim() !== '') {
            const n = parseInt(String(activityIdRaw), 10);
            setActivityIdFilter(Number.isFinite(n) ? n : null);
        } else {
            setActivityIdFilter(null);
        }

        if (status) {
            setStatusFilter(status);
        } else {
            setStatusFilter('All');
        }
        
        // Always reset to page 1 when any filter/mode changes via URL
        setCurrentPage(1);
    }, [searchParams]);

    useEffect(() => {
        if (viewMode !== 'table') setTableDetailsTask(null);
    }, [viewMode]);

    useEffect(() => {
        if (!tableDetailsTask) {
            setTableDetailsReview(null);
            setTableDetailsReviewLoading(false);
            return;
        }
        // Inline review record only (for Completed) — avoids opening a second modal from Process details.
        if (tableDetailsTask.status !== 'Completed') {
            setTableDetailsReview(null);
            setTableDetailsReviewLoading(false);
            return;
        }
        let cancelled = false;
        setTableDetailsReviewLoading(true);
        axios
            .get(`/api/department-head/evaluations?taskId=${tableDetailsTask.id}`)
            .then((res) => {
                if (cancelled) return;
                const completedList = res.data?.completed || [];
                setTableDetailsReview(completedList.length > 0 ? completedList[0] : null);
            })
            .catch(() => {
                if (cancelled) return;
                setTableDetailsReview(null);
            })
            .finally(() => {
                if (cancelled) return;
                setTableDetailsReviewLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [tableDetailsTask]);


    useEffect(() => {
        if (openProcessTask) {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            setOpenProcessStart(`${y}-${m}-${day}`);
        }
    }, [openProcessTask]);

    const openProcessComputedDue = useMemo(() => {
        if (!openProcessTask || !openProcessStart) return '';
        const dv = openProcessTask.duration_value;
        const du = openProcessTask.duration_unit;
        if (dv == null || !String(du || '').trim()) return '';
        return addDurationToStartDate(openProcessStart, dv, du);
    }, [openProcessTask, openProcessStart]);

    useEffect(() => {
        if (!evaluateModalItem) {
            setFeedbackHistoryForReview([]);
            return;
        }
        let cancelled = false;
        axios
            .get(`/api/department-head/staff-reports/${evaluateModalItem.id}/feedback-events`)
            .then((res) => {
                if (!cancelled) setFeedbackHistoryForReview(res.data?.events || []);
            })
            .catch(() => {
                if (!cancelled) setFeedbackHistoryForReview([]);
            });
        return () => {
            cancelled = true;
        };
    }, [evaluateModalItem]);

    useEffect(() => {
        if (reassignTask) {
            setReassignReasonCode('');
            setReassignDescription('');
            setReassignStaffId('');
        }
    }, [reassignTask]);

    useEffect(() => {
        if (reassignSubtaskCtx) {
            setReassignSubtaskStaffId('');
            setReassignSubtaskReasonCode('');
            setReassignSubtaskDescription('');
        }
    }, [reassignSubtaskCtx]);

    // Helper to update URL and trigger navigation
    const navigate = (mode: 'table' | 'grid' | 'activity', activity?: string, status?: string) => {
        const params = new URLSearchParams(searchParams.toString());
        
        // Ensure we preserve the page context
        params.set('pg', 'tasks');
        params.set('mode', mode);
        
        if (activity) {
            params.set('activity', activity);
        } else if (mode === 'activity') {
            params.delete('activity');
        }
        
        if (status && status !== 'All') {
            params.set('status', status);
        } else {
            params.delete('status');
        }

        const url = `${window.location.pathname}?${params.toString()}`;
        
        // Push state ONLY when entering detailed mode (Table/Grid) FROM activity hub.
        // Otherwise replace to keep the hub as the single 'Back' target.
        if (viewMode === 'activity' && mode !== 'activity') {
            router.push(url);
        } else {
            router.replace(url);
        }
    };




    if (error) {
        return (
            <div className="container mt-5">
                <div className="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 p-4" role="alert">
                    <span className="material-symbols-outlined fs-2 text-danger">error</span>
                    <div>
                        <h5 className="alert-heading text-danger fw-bold mb-1">Error Loading Tasks</h5>
                        <p className="mb-0 text-dark opacity-75">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const DEPT_INTERNAL_LABEL = 'Department task';

    const normalizeForCompare = (s: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

    const filterTasks = (tasks: Task[]): Task[] => {
        return tasks.filter(t => {
            let hasActivityIdMatch = false;
            if (activityIdFilter != null) {
                const tid = Number((t as any).activity_id);
                if (!Number.isFinite(tid) || tid !== activityIdFilter) return false;
                hasActivityIdMatch = true;
            }

            const taskActivity = (t.activity_title ?? '').trim();
            const displayActivity = taskActivity === '' ? DEPT_INTERNAL_LABEL : (t.activity_title ?? '');
            const taskAssignee = (t.assignee_name ?? '').trim();
            const displayAssignee = taskAssignee === '' ? UNASSIGNED_LABEL : (t.assignee_name ?? '');

            const matchesActivity =
                hasActivityIdMatch ||
                activityFilter === 'All Tasks' ||
                (activityFilter === 'All Strategic Activities' && displayActivity !== DEPT_INTERNAL_LABEL) ||
                normalizeForCompare(displayActivity) === normalizeForCompare(activityFilter);
            const matchesAssignee = assigneeFilter === 'All Assignees' || 
            (assigneeFilter === UNASSIGNED_LABEL ? !t.assigned_to : t.assignee_name === assigneeFilter);
        
            const p = t.progress || 0;
            const s = (t.status ?? '').trim().toLowerCase();
            const f = (statusFilter || 'All').trim().toLowerCase();
            
            const matchesStatus = f === 'all' ||
                (f === 'completed' && (p >= 100 || s === 'completed')) ||
                (f === 'in progress' && p > 0 && p < 100) ||
                // "Not completed" = not started (0% progress)
                (f === 'not completed' && p === 0 && s !== 'completed');

            return matchesActivity && matchesAssignee && matchesStatus;
        });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const formatDateWithYear = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const getProcessDueFootnote = (task: Task): string => {
        if (task.tier !== 'process_task') return '—';
        if (task.status === 'Not opened' || !task.dueDate) return '—';
        const ymd = String(task.dueDate).slice(0, 10);
        const end = new Date(`${ymd}T12:00:00`);
        if (Number.isNaN(end.getTime())) return formatDate(task.dueDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
        const dLabel = formatDate(ymd);
        if (diff < 0) return `${dLabel} · ${Math.abs(diff)}d overdue`;
        if (diff === 0) return `${dLabel} · Due today`;
        return `${dLabel} · ${diff}d left`;
    };

    /** Matches department-head evaluations page for submission timestamps in the evaluate modal. */
    const formatEvaluationModalDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const handleDeleteTask = async (task: Task) => {
        const isProcess = task.tier === 'process_task';
        if (isProcess && task.status === 'Completed') {
            setMessageModal({
                show: true,
                title: 'Action not allowed',
                message: 'This process task is already completed and cannot be unassigned or reassigned.',
                type: 'warning',
            });
            return;
        }
        if (!window.confirm(isProcess ? `Unassign process "${task.title}"? This cannot be undone.` : `Delete task "${task.title}"? This cannot be undone.`)) return;
        setDeletingId(task.id);
        try {
            if (isProcess) {
                await axios.delete(`/api/department-head/process-assignments/${task.id}`);
            } else {
                await axios.delete(`/api/department-head/tasks/${task.id}`);
            }
            await fetchData();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'This task cannot be removed (e.g. it may be a strategic goal).';
            setMessageModal({
                show: true,
                title: 'Cannot remove',
                message: msg,
                type: 'error'
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleTaskSelect = (taskId: number) => {
        setSelectedTaskIds(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTaskIds(pagedTasks.map(t => t.id));
        } else {
            setSelectedTaskIds([]);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedTaskIds.length === 0) return;
        
        setIsBulkDeleting(true);
        setBulkDeleteError(null);
        try {
            const selectedTasks = selectedTaskIds
                .map((id) => allTasks.find((x) => x.id === id))
                .filter(Boolean) as Task[];

            const blockedCompleted = selectedTasks.filter((t) => t.tier === 'process_task' && t.status === 'Completed');
            if (blockedCompleted.length > 0) {
                setMessageModal({
                    show: true,
                    title: 'Some selections cannot be removed',
                    message: `Completed process tasks cannot be unassigned. Remove them from selection and try again.`,
                    type: 'warning',
                });
                setIsBulkDeleting(false);
                return;
            }

            await Promise.all(
                selectedTaskIds.map((id) => {
                    const t = allTasks.find((x) => x.id === id);
                    if (t?.tier === 'process_task') {
                        return axios.delete(`/api/department-head/process-assignments/${id}`);
                    }
                    return axios.delete(`/api/department-head/tasks/${id}`);
                })
            );
            setSelectedTaskIds([]);
            setShowBulkDeleteModal(false);
            await fetchData();
        } catch (err: any) {
            console.error('Error during bulk delete:', err);
            setBulkDeleteError('Some tasks could not be deleted (e.g. they may be strategic goals).');
            await fetchData();
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleSubmitOpenProcess = async () => {
        if (!openProcessTask) return;
        if (!openProcessStart.trim()) {
            setMessageModal({
                show: true,
                title: 'Start date required',
                message: 'Please set when this process should start.',
                type: 'warning',
            });
            return;
        }
        setOpenProcessSaving(true);
        try {
            await axios.post(`/api/department-head/process-assignments/${openProcessTask.id}/open`, {
                start_date: openProcessStart,
                force: true,
            });
            setOpenProcessTask(null);
            await fetchData();
            setMessageModal({
                show: true,
                title: 'Process opened',
                message:
                    'The due date was set from the standard process duration. Staff can work and submit within that window.',
                type: 'success',
            });
        } catch (err: any) {
            setMessageModal({
                show: true,
                title: 'Could not open process',
                message: err.response?.data?.message || 'Request failed.',
                type: 'error',
            });
        } finally {
            setOpenProcessSaving(false);
        }
    };

    const handleStartBulkOpen = () => {
        const selectedTasks = selectedTaskIds
            .map((id) => allTasks.find((t) => t.id === id))
            .filter(Boolean) as Task[];

        const nonProcess = selectedTasks.filter((t) => t.tier !== 'process_task');
        if (nonProcess.length > 0) {
            setMessageModal({
                show: true,
                title: 'Only process tasks can be opened',
                message: 'Remove non-process items from your selection, then try again.',
                type: 'warning',
            });
            return;
        }

        const notOpened = selectedTasks.filter((t) => String(t.status) !== 'Not opened');
        if (notOpened.length > 0) {
            setMessageModal({
                show: true,
                title: 'Some selections cannot be opened',
                message: 'Only processes with status "Not opened" can be opened. Remove already opened/completed items and try again.',
                type: 'warning',
            });
            return;
        }

        if (!bulkOpenStart.trim()) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            setBulkOpenStart(`${y}-${m}-${d}`);
        }
        setShowBulkOpenModal(true);
    };

    const handleSubmitBulkOpen = async () => {
        if (!bulkOpenStart.trim()) {
            setMessageModal({
                show: true,
                title: 'Start date required',
                message: 'Please set when these processes should start.',
                type: 'warning',
            });
            return;
        }

        const eligible = selectedTaskIds
            .map((id) => allTasks.find((t) => t.id === id))
            .filter((t): t is Task => Boolean(t))
            .filter((t) => t.tier === 'process_task' && String(t.status) === 'Not opened');

        if (eligible.length === 0) {
            setShowBulkOpenModal(false);
            setMessageModal({
                show: true,
                title: 'Nothing to open',
                message: 'Select one or more processes with status "Not opened".',
                type: 'warning',
            });
            return;
        }

        setBulkOpenSaving(true);
        try {
            const results = await Promise.allSettled(
                eligible.map((t) =>
                    axios.post(`/api/department-head/process-assignments/${t.id}/open`, {
                        start_date: bulkOpenStart,
                        force: true,
                    })
                )
            );

            const failed = results.filter((r) => r.status === 'rejected').length;
            const opened = results.length - failed;

            setShowBulkOpenModal(false);
            setSelectedTaskIds([]);
            await fetchData();

            setMessageModal({
                show: true,
                title: failed > 0 ? 'Bulk open completed with errors' : 'Processes opened',
                message:
                    failed > 0
                        ? `Opened ${opened} process(es). ${failed} failed — please try opening those individually.`
                        : `Opened ${opened} process(es). Due dates were set from the standard process duration.`,
                type: failed > 0 ? 'warning' : 'success',
            });
        } catch (err: any) {
            setMessageModal({
                show: true,
                title: 'Could not open processes',
                message: err.response?.data?.message || 'Request failed.',
                type: 'error',
            });
        } finally {
            setBulkOpenSaving(false);
        }
    };

    const handleSubmitReassign = async () => {
        if (!reassignTask) return;
        if (!reassignReasonCode.trim()) {
            setMessageModal({
                show: true,
                title: 'Reason required',
                message: 'Select a reason for this reassignment.',
                type: 'warning',
            });
            return;
        }
        if (reassignReasonCode === 'other' && !String(reassignDescription).trim()) {
            setMessageModal({
                show: true,
                title: 'Description required',
                message: 'When the reason is “Other”, add a short description.',
                type: 'warning',
            });
            return;
        }
        if (reassignStaffId === '' || reassignStaffId === reassignTask.assigned_to) {
            setMessageModal({
                show: true,
                title: 'Choose another staff member',
                message: 'Select a different assignee for this process.',
                type: 'warning',
            });
            return;
        }
        setReassignSaving(true);
        try {
            await axios.post(`/api/department-head/process-assignments/${reassignTask.id}/reassign`, {
                new_staff_id: reassignStaffId,
                reason_code: reassignReasonCode.trim(),
                description: String(reassignDescription).trim() || undefined,
            });
            setReassignTask(null);
            setReassignReasonCode('');
            setReassignDescription('');
            setReassignStaffId('');
            await fetchData();
            setMessageModal({
                show: true,
                title: 'Process reassigned',
                message:
                    'Assignment updated. Dates were cleared — open the process again when the new assignee should start. Previous and new assignees were notified in the app.',
                type: 'success',
            });
        } catch (err: any) {
            setMessageModal({
                show: true,
                title: 'Reassign failed',
                message: err.response?.data?.message || 'Request failed.',
                type: 'error',
            });
        } finally {
            setReassignSaving(false);
        }
    };

    const handleSubmitReassignSubtask = async () => {
        if (!reassignSubtaskCtx) return;
        if (!reassignSubtaskReasonCode.trim()) {
            setMessageModal({
                show: true,
                title: 'Reason required',
                message: 'Select a reason for this reassignment.',
                type: 'warning',
            });
            return;
        }
        if (reassignSubtaskReasonCode === 'other' && !String(reassignSubtaskDescription).trim()) {
            setMessageModal({
                show: true,
                title: 'Description required',
                message: 'When the reason is “Other”, add a short description.',
                type: 'warning',
            });
            return;
        }
        if (
            reassignSubtaskStaffId === '' ||
            reassignSubtaskStaffId === reassignSubtaskCtx.subtask.assigned_to
        ) {
            setMessageModal({
                show: true,
                title: 'Choose another staff member',
                message: 'Select a different assignee for this sub-task.',
                type: 'warning',
            });
            return;
        }
        setReassignSubtaskSaving(true);
        try {
            await axios.post(
                `/api/department-head/process-assignments/${reassignSubtaskCtx.assignmentId}/subtasks/${reassignSubtaskCtx.subtask.id}/reassign`,
                {
                    new_staff_id: reassignSubtaskStaffId,
                    reason_code: reassignSubtaskReasonCode.trim(),
                    description: String(reassignSubtaskDescription).trim() || undefined,
                }
            );
            setReassignSubtaskCtx(null);
            await fetchData();
            setMessageModal({
                show: true,
                title: 'Sub-task reassigned',
                message:
                    'The sub-task assignee was updated. Previous and new assignees were notified in the app.',
                type: 'success',
            });
        } catch (err: any) {
            setMessageModal({
                show: true,
                title: 'Reassign failed',
                message: err.response?.data?.message || 'Request failed.',
                type: 'error',
            });
        } finally {
            setReassignSubtaskSaving(false);
        }
    };


    const allTasks = [
        ...data.kanban.todo,
        ...data.kanban.inProgress,
        ...data.kanban.underReview,
        ...data.kanban.completed
    ];

    const activityFilterOptions = [
        'All Tasks',
        'All Strategic Activities',
        ...availableActivities.map(a => a.title),
        ...(allTasks.some(t => !(t.activity_title ?? '').trim()) ? [DEPT_INTERNAL_LABEL] : [])
    ];
    const assigneeFilterOptions = [
        'All Assignees',
        ...Array.from(new Set(
            allTasks.map(t => (t.assignee_name ?? '').trim()).filter(n => n.length > 0)
        )),
        ...(allTasks.some(t => !(t.assignee_name ?? '').trim()) ? [UNASSIGNED_LABEL] : [])
    ];
 
    const filteredTasks = filterTasks(allTasks);
    const isDepartmentalTaskTable =
        viewMode === 'table' &&
        filteredTasks.length > 0 &&
        // Departmental tasks are non-strategic (source is empty/null in tasks API).
        filteredTasks.every((t) => !String((t as any).source ?? '').trim());

    // Filter counts for the dropdown - must honor current activity/assignee filters but NOT status filter
    const getStatusCount = (f: string) => {
        const filterVal = f.toLowerCase();
        const baseFiltered = allTasks.filter(t => {
            const taskActivity = (t.activity_title ?? '').trim();
            const displayActivity = taskActivity === '' ? DEPT_INTERNAL_LABEL : (t.activity_title ?? '');
            const matchesActivity = activityFilter === 'All Tasks' || 
                (activityFilter === 'All Strategic Activities' && displayActivity !== DEPT_INTERNAL_LABEL) ||
                normalizeForCompare(displayActivity) === normalizeForCompare(activityFilter);
            const matchesAssignee = assigneeFilter === 'All Assignees' || 
                (assigneeFilter === UNASSIGNED_LABEL ? !t.assigned_to : t.assignee_name === assigneeFilter);
            return matchesActivity && matchesAssignee;
        });

        return baseFiltered.filter(t => {
            const p = t.progress || 0;
            const s = (t.status ?? '').trim().toLowerCase();
            if (filterVal === 'all') return true;
            if (filterVal === 'completed') return p >= 100 || s === 'completed';
            if (filterVal === 'in progress') return p > 0 && p < 100;
            // "Not completed" = not started (0% progress)
            if (filterVal === 'not completed') return p === 0 && s !== 'completed';
            if (filterVal === 'todo') return p === 0 && s !== 'completed';
            return false;
        }).length;
    };
 
    // Group tasks by activity for the 'activity' view
    const groupedByActivity = filteredTasks.reduce((acc, task) => {
        const key = task.activity_title || DEPT_INTERNAL_LABEL;
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
    }, {} as Record<string, Task[]>);


    const activityGroups = Object.entries(groupedByActivity).map(([title, tasks]) => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.progress >= 100 || t.status === 'Completed').length;
        const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
        const todo = tasks.filter(t => (t.progress || 0) === 0 && t.status !== 'Completed').length;
        const avgProgress = Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / (total || 1));
        
        // Enrich from availableActivities metadata
        const meta = availableActivities.find(a => a.title === title);
        return { 
            title, 
            tasks, 
            total, 
            completed, 
            inProgress,
            todo,
            avgProgress,
            pillar: (meta as any)?.pillar,
            startDate: (meta as any)?.start_date,
            endDate: (meta as any)?.end_date,
            kpiTargetValue: (meta as any)?.kpi_target_value,
            actualValue: (meta as any)?.actual_value,
            status: (meta as any)?.status
        };
    }).sort((a, b) => {
        if (a.title === DEPT_INTERNAL_LABEL) return 1;
        if (b.title === DEPT_INTERNAL_LABEL) return -1;
        return a.title.localeCompare(b.title);
    });

    const isDepartmentProcessTask = (t: Task) => !String((t as any).source ?? '').trim();
    const activityGroupsForCards = activityGroups
        .map((group) => {
            const scopedTasks = group.tasks.filter((t) => {
                if (activityProcessScope === 'all') return true;
                if (activityProcessScope === 'strategic') return !isDepartmentProcessTask(t);
                return isDepartmentProcessTask(t);
            });
            if (scopedTasks.length === 0) return null;
            const total = scopedTasks.length;
            const completed = scopedTasks.filter((t) => t.progress >= 100 || t.status === 'Completed').length;
            const inProgress = scopedTasks.filter((t) => t.progress > 0 && t.progress < 100).length;
            const todo = scopedTasks.filter((t) => (t.progress || 0) === 0 && t.status !== 'Completed').length;
            const avgProgress = Math.round(
                scopedTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / (total || 1)
            );
            return {
                ...group,
                tasks: scopedTasks,
                total,
                completed,
                inProgress,
                todo,
                avgProgress,
            };
        })
        .filter(Boolean) as typeof activityGroups;

    // Evaluation Helpers & Handlers
    const handleViewEvaluation = async (taskId: number) => {
        try {
            setIsEvaluationLoading(true);
            const res = await axios.get(`/api/department-head/evaluations?taskId=${taskId}`);
            const pendingList = res.data.pending || [];
            if (pendingList.length > 0) {
                setEvaluateModalItem(pendingList[0]);
                return;
            }
            const completedList = res.data.completed || [];
            if (completedList.length > 0) {
                setViewModalItem(completedList[0]);
            } else {
                setMessageModal({
                    show: true,
                    title: 'No submission record',
                    message: 'There is no submission on file for this task yet, or it was updated outside the normal flow.',
                    type: 'info'
                });
            }
        } catch (err) {
            console.error('Error fetching evaluation:', err);
            setMessageModal({
                show: true,
                title: 'Fetch Error',
                message: 'Failed to load evaluation details. Please check your connection and try again.',
                type: 'error'
            });
        } finally {
            setIsEvaluationLoading(false);
        }
    };

    const closeTableProcessDetails = () => setTableDetailsTask(null);

    /** Same rules as grid cards: stacked actions for the table “View details” modal */
    const renderProcessTaskModalActions = (task: Task) => {
        const btnBase = 'btn btn-sm d-flex align-items-center justify-content-center gap-1 w-100';
        const onEval = () => {
            closeTableProcessDetails();
            void handleViewEvaluation(task.id);
        };
        const onOpen = () => {
            closeTableProcessDetails();
            setOpenProcessTask(task);
        };
        const onReassign = () => {
            closeTableProcessDetails();
            setReassignTask(task);
        };
        const onRemove = () => {
            closeTableProcessDetails();
            void handleDeleteTask(task);
        };

        return (
            <div className="d-flex flex-column gap-2 w-100">
                {task.status === 'Under Review' ? (
                    <button
                        type="button"
                        className={`${btnBase} btn-primary fw-bold shadow-sm`}
                        style={{ fontSize: '.85rem', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                        onClick={onEval}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            fact_check
                        </span>
                        Review submission
                    </button>
                ) : (
                    <>
                        {task.tier === 'process_task' && task.status === 'Not opened' && (
                            <button
                                type="button"
                                className={`${btnBase} btn-success`}
                                style={{ fontSize: '.85rem' }}
                                onClick={onOpen}
                                title="Set a start date; due date comes from the process duration"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    event_available
                                </span>
                                Open process
                            </button>
                        )}
                        {task.tier === 'process_task' &&
                            task.assigned_to != null &&
                            !['Completed', 'Under Review'].includes(task.status) && (
                                <button
                                    type="button"
                                    className={`${btnBase} btn-outline-secondary`}
                                    style={{ fontSize: '.85rem' }}
                                    onClick={onReassign}
                                    title="Reassign to another staff member"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                        swap_horiz
                                    </span>
                                    Reassign
                                </button>
                            )}
                        {task.status !== 'Completed' && (
                            <button
                                type="button"
                                className={`${btnBase} btn-outline-danger`}
                                style={{ fontSize: '.85rem' }}
                                onClick={onRemove}
                                disabled={deletingId === task.id}
                                title={task.tier === 'process_task' ? 'Unassign process' : 'Delete task'}
                            >
                                {deletingId === task.id ? (
                                    <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />
                                ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                        person_remove
                                    </span>
                                )}
                                {task.tier === 'process_task' ? 'Unassign' : 'Delete'}
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    };

    const handleSubmitEvaluation = async () => {
        if (!evaluateModalItem) return;
        const id = evaluateModalItem.id;
        const status = selectedRating[id];
        const comment = evaluationComments[id];
        const isKpiDriver = evaluateModalItem.task_type === 'kpi_driver';
        const kpiActual = kpiActualValues[id];

        if (!status) {
            setMessageModal({
                show: true,
                title: 'Decision required',
                message: 'Choose approve completion, request revision, or mark not done.',
                type: 'warning'
            });
            return;
        }
        if (status === 'Incomplete' && (!comment || String(comment).trim() === '')) {
            setMessageModal({
                show: true,
                title: 'Comment required',
                message: 'Add feedback explaining what the staff member should revise.',
                type: 'warning'
            });
            return;
        }

        const score = status === 'Complete' ? 2 : status === 'Incomplete' ? 1 : 0;
        try {
            setIsSubmitting(true);
            const res = await axios.put('/api/department-head/evaluations', {
                id,
                status,
                score,
                reviewer_notes: comment || '',
                kpi_actual_value:
                    status === 'Complete' && isKpiDriver && kpiActual != null && String(kpiActual).trim() !== ''
                        ? Number(kpiActual)
                        : undefined,
            });

            // Refresh tasks
            await fetchData();

            if (status === 'Complete') {
                const isProcess = evaluateModalItem.task_type !== 'kpi_driver';
                const delayed = res.data?.delayedHodNoteApplied as boolean | undefined;
                if (isProcess) {
                    setMessageModal({
                        show: true,
                        title: 'Review saved',
                        message: 'Completion approved; full credit recorded for this process task.',
                        type: 'success',
                    });
                } else if (delayed) {
                    setMessageModal({
                        show: true,
                        title: 'Review saved',
                        message:
                            'Marked complete. The feedback includes a system note about timing of the review.',
                        type: 'info',
                    });
                }
            }

            // Close modal and reset
            setEvaluateModalItem(null);
            setSelectedRating(prev => { const next = { ...prev }; delete next[id]; return next; });
            setEvaluationComments(prev => { const next = { ...prev }; delete next[id]; return next; });
            setKpiActualValues(prev => { const next = { ...prev }; delete next[id]; return next; });
        } catch (error: any) {
            console.error('Error submitting evaluation:', error);
            const msg = error.response?.data?.message || 'Failed to save review.';
            setMessageModal({
                show: true,
                title: 'Could not save',
                message: msg,
                type: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Rating used to evaluate: Complete, Incomplete, or Not Done. */
    const getRatingLabel = (e: { score?: number | null; status: string }): string => {
        if (e.status === 'Pending') return '—';
        if (e.score != null && e.score <= 2) {
            if (e.score === 2) return 'Complete';
            if (e.score === 1) {
                if (e.status === 'Completed') return 'Complete (1 pt)';
                return 'Incomplete';
            }
            if (e.score === 0 && e.status === 'Completed') return 'Complete (0 pt)';
            return 'Not Done';
        }
        if (e.status === 'Completed') return 'Complete';
        if (e.status === 'Not Done') return 'Not Done';
        if (e.status === 'Incomplete' || e.status === 'Returned') return 'Incomplete';
        return '—';
    };

    // Pagination logic
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedTasks = filteredTasks.slice(startIndex, startIndex + pageSize);

    return (
        <div id="page-tasks" className="page-section active-page">
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="assignment"
                        label="Total Processes"
                        value={getStatusCount('All')}
                        badge="Assigned"
                        badgeIcon="info"
                        color="blue"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="check_circle"
                        label="Completed"
                        value={getStatusCount('Completed')}
                        badge="Done"
                        badgeIcon="done_all"
                        color="green"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="pending"
                        label="In Progress"
                        value={getStatusCount('In Progress')}
                        badge="Active"
                        badgeIcon="trending_up"
                        color="yellow"
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <StatCard
                        icon="list_alt"
                        label="To Do"
                        value={getStatusCount('Todo')}
                        badge="Pending"
                        badgeIcon="hourglass_empty"
                        color="red"
                    />
                </div>
            </div>

            <div
                className={`table-card ${viewMode === 'activity' ? 'shadow-sm' : 'p-0 overflow-hidden'}`}
                style={viewMode === 'activity' ? undefined : { borderRadius: '20px', border: '1px solid #e2e8f0' }}
            >
                <div
                    className={`table-card-header ${viewMode !== 'activity' ? 'd-flex justify-content-between align-items-center p-4' : ''}`}
                    style={viewMode !== 'activity' ? { background: '#fff', borderBottom: '1px solid #f1f5f9' } : undefined}
                >
                    <div>
                        <h5
                            className={`d-flex align-items-center gap-2 ${viewMode !== 'activity' ? 'mb-0 fw-bold' : 'mb-1'}`}
                            style={viewMode !== 'activity' ? { color: 'var(--mubs-navy)' } : undefined}
                        >
                            <span className="material-symbols-outlined" style={{ color: 'var(--mubs-blue)' }}>checklist</span>
                            {viewMode === 'activity' ? 'Assigned Processes' : 'Activity Processes'}
                        </h5>
                        {viewMode !== 'activity' && (
                            <div className="text-muted small d-flex align-items-center gap-1 mt-1">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                                {activityFilter}
                            </div>
                        )}
                    </div>

                    <div className="d-flex gap-2 align-items-center flex-nowrap ms-auto">
                        {viewMode !== 'activity' ? (
                            <div className="btn-group border rounded-3 p-1 bg-light shadow-sm" style={{ height: '32px' }}>
                                <button
                                    type="button"
                                    className={`btn btn-sm d-flex align-items-center justify-content-center ${viewMode === 'grid' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                                    onClick={() => navigate('grid', activityFilter)}
                                    style={{ borderRadius: '6px', width: '32px', height: '24px', transition: 'all 0.2s', padding: 0 }}
                                    title="Grid View"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm d-flex align-items-center justify-content-center ${viewMode === 'table' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                                    onClick={() => navigate('table', activityFilter)}
                                    style={{ borderRadius: '6px', width: '32px', height: '24px', transition: 'all 0.2s', padding: 0 }}
                                    title="Table View"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table_rows</span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                {viewMode !== 'activity' && (
                    <div className="d-flex px-4 pt-2 bg-white border-bottom gap-4" style={{ overflowX: 'auto' }}>
                        {(
                            [
                                { value: 'All', label: 'All', badgeBg: '#f1f5f9', badgeColor: '#475569' },
                                { value: 'Not Completed', label: 'Not completed', badgeBg: '#fef3c7', badgeColor: '#92400e' },
                                { value: 'In Progress', label: 'In progress', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
                                { value: 'Completed', label: 'Completed', badgeBg: '#dcfce7', badgeColor: '#15803d' },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                className={`pb-2 px-1 fw-bold border-0 bg-transparent position-relative flex-shrink-0 ${statusFilter === tab.value ? 'text-primary' : 'text-muted'}`}
                                style={{ fontSize: '0.82rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                                onClick={() => navigate(viewMode, activityFilter, tab.value)}
                            >
                                {tab.label}
                                <span
                                    className="badge rounded-pill ms-2"
                                    style={{ background: tab.badgeBg, color: tab.badgeColor, fontSize: '0.65rem' }}
                                >
                                    {getStatusCount(tab.value)}
                                </span>
                                {statusFilter === tab.value && (
                                    <div
                                        className="position-absolute bottom-0 start-0 w-100 bg-primary"
                                        style={{ height: '3px', borderRadius: '3px 3px 0 0' }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Bulk Actions Bar */}
                {selectedTaskIds.length > 0 && (
                    <div className="alert alert-primary d-flex align-items-center justify-content-between p-2 m-3 shadow-sm border" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                        <div className="d-flex align-items-center gap-2 px-2">
                            <span className="material-symbols-outlined rounded-circle" style={{ fontSize: '20px', color: '#166534' }}>check_circle</span>
                            <span className="fw-bold" style={{ fontSize: '.9rem' }}>{selectedTaskIds.length} processes selected</span>
                        </div>
                        <div className="d-flex gap-2">
                            <button 
                                className="btn btn-sm btn-outline-secondary fw-bold bg-white" 
                                onClick={() => setSelectedTaskIds([])}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm"
                                onClick={handleStartBulkOpen}
                                disabled={bulkOpenSaving || isBulkDeleting}
                                title="Open all selected processes (set the same start date)"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>event_available</span>
                                Open Selected
                            </button>
                            <button 
                                className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm" 
                                onClick={() => setShowBulkDeleteModal(true)}
                                disabled={isBulkDeleting}
                            >
                                {isBulkDeleting ? (
                                    <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />
                                ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_remove</span>
                                )}
                                Unassign Selected
                            </button>
                        </div>
                    </div>
                )}
                                {viewMode === 'activity' ? (
                    <div className="p-4" style={{ background: '#f8fafc' }}>
                        <div className="d-flex gap-2 flex-wrap mb-3">
                            {[
                                { id: 'all', label: 'All processes' },
                                { id: 'strategic', label: 'Strategic processes' },
                                { id: 'department', label: 'Department processes' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`btn btn-sm fw-bold ${activityProcessScope === opt.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    style={{ borderRadius: '10px', fontSize: '.75rem' }}
                                    onClick={() => setActivityProcessScope(opt.id as 'all' | 'strategic' | 'department')}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="row g-4">
                            {activityGroupsForCards.map((group) => (
                                <div key={group.title} className="col-12 col-md-6 col-xl-4">
                                    <div 
                                        className="card h-100 border-0 shadow-sm" 
                                        style={{ 
                                            transition: 'all 0.3s ease', 
                                            borderRadius: '20px',
                                            cursor: 'default',
                                            backgroundColor: '#ffffff'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-10px)';
                                            e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 .125rem .25rem rgba(0,0,0,.075)';
                                        }}
                                    >
                                        <div className="card-body p-4 d-flex flex-column">
                                            <div className="mb-3">
                                                <h6 className="card-title fw-bold text-dark mb-1" style={{ fontSize: '1rem', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '3rem' }}>
                                                    {group.title}
                                                </h6>
                                            </div>

                                            {/* KPI Metrics - if available */}
                                            {group.kpiTargetValue != null && (
                                                <div className="mb-3 p-2 rounded bg-light border border-dashed">
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>KPI Actual vs Target</span>
                                                        <span className="fw-bold" style={{ fontSize: '0.75rem' }}>
                                                            {group.actualValue || 0} / {group.kpiTargetValue}
                                                        </span>
                                                    </div>
                                                    <div className="progress" style={{ height: '4px' }}>
                                                        <div className="progress-bar bg-info" style={{ width: `${Math.min(100, (group.actualValue || 0) / (group.kpiTargetValue || 1) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-auto">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="text-muted small">Completion</span>
                                                    <span className="fw-bold small">{group.avgProgress}%</span>
                                                </div>
                                                <div className="progress mb-3" style={{ height: '8px', borderRadius: '10px' }}>
                                                    <div className="progress-bar" style={{ 
                                                        width: `${group.avgProgress}%`,
                                                        background: group.avgProgress > 70 ? '#10b981' : (group.avgProgress > 30 ? '#f59e0b' : '#3b82f6'),
                                                        borderRadius: '10px'
                                                    }}></div>
                                                </div>

                                                <div className="d-flex align-items-center justify-content-between pt-3 border-top">
                                                    <div className="d-grid flex-grow-1" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                                        <div className="text-center">
                                                            <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{group.total}</div>
                                                            <div className="text-muted small" style={{ fontSize: '0.6rem' }}>Total processes</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="fw-bold text-danger" style={{ fontSize: '0.9rem' }}>{group.todo}</div>
                                                            <div className="text-muted small" style={{ fontSize: '0.6rem' }}>To Do</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="fw-bold text-warning" style={{ fontSize: '0.9rem' }}>{group.inProgress}</div>
                                                            <div className="text-muted small" style={{ fontSize: '0.6rem' }}>Doing</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="fw-bold text-success" style={{ fontSize: '0.9rem' }}>{group.completed}</div>
                                                            <div className="text-muted small" style={{ fontSize: '0.6rem' }}>Done</div>
                                                        </div>
                                                    </div>
                                                    <div className="ms-2">
                                                        <button 
                                                            className="btn btn-sm fw-bold d-flex align-items-center gap-1"
                                                            onClick={() => navigate('table', group.title)}
                                                            style={{ borderRadius: '8px', padding: '6px 12px', background: 'var(--mubs-blue)', color: '#fff', fontSize: '0.75rem' }}
                                                        >
                                                            Details
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {activityGroupsForCards.length === 0 && (
                                <div className="col-12 text-center py-5">
                                    <div className="text-muted">No activities found matching filters.</div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="p-4 bg-white">
                        <DepartmentTaskCardGrid 
                            tasks={pagedTasks}
                            onDelete={handleDeleteTask}
                            onViewEvaluation={handleViewEvaluation}
                            onOpenProcess={(t) => setOpenProcessTask(t)}
                            onReassignProcess={(t) => setReassignTask(t)}
                            deletingId={deletingId}
                            selectedTaskIds={selectedTaskIds}
                            onToggleTaskSelect={handleToggleTaskSelect}
                        />
                    </div>
                ) : (
                    <div className="table-responsive bg-white">
                        <table className="table mb-0 align-middle department-tasks-processes-table">
                            <thead className="bg-light">
                            <tr>
                                <th className="ps-4" style={{ width: '40px' }}>
                                    <div className="form-check m-0">
                                        <input 
                                            className="form-check-input" 
                                            type="checkbox" 
                                            checked={pagedTasks.length > 0 && pagedTasks.every(t => selectedTaskIds.includes(t.id))}
                                            onChange={handleSelectAll}
                                            style={{ cursor: 'pointer', borderColor: '#cbd5e1' }}
                                        />
                                    </div>
                                </th>
                                <th>{isDepartmentalTaskTable ? 'Task' : 'Process'}</th>
                                {!isDepartmentalTaskTable && <th>Performance indicator</th>}
                                {!isDepartmentalTaskTable && <th>Strategic Activity</th>}
                                <th>Staff Assigned</th>
                                <th>Due</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th className="pe-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody key={`tasks-${activityFilter}-${assigneeFilter}-${pagedTasks.length}`}>
                            {pagedTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={isDepartmentalTaskTable ? 7 : 9} className="text-center py-4 text-muted">
                                        <span
                                            className="material-symbols-outlined d-block mb-2 mx-auto"
                                            style={{ fontSize: '36px', opacity: 0.3 }}
                                        >checklist</span>
                                        No processes found in this section.
                                    </td>
                                </tr>
                            ) : (
                                pagedTasks.map((task, idx) => {
                                    const isContainerProcess =
                                        task.tier === 'process_task' &&
                                        (task.assigned_to == null || String(task.assignee_name || '').trim() === '');
                                    const subtasks = isContainerProcess ? (subtasksByProcessAssignmentId[task.id] || []) : [];
                                    const expanded = !!expandedProcessAssignmentIds[task.id];
                                    return (
                                    <>
                                    <tr key={`task-${task.id}-${task.assigned_to ?? 'u'}-${idx}`} className={selectedTaskIds.includes(task.id) ? 'bg-primary bg-opacity-10' : ''}>
                                        <td className="ps-4">
                                            <div className="form-check m-0">
                                                <input 
                                                    className="form-check-input" 
                                                    type="checkbox" 
                                                    checked={selectedTaskIds.includes(task.id)}
                                                    onChange={() => handleToggleTaskSelect(task.id)}
                                                    disabled={task.tier === 'process_task' && task.status === 'Completed'}
                                                    style={{ cursor: 'pointer', borderColor: '#cbd5e1' }}
                                                />
                                            </div>
                                        </td>
                                        <td className="small text-dark fw-normal" style={{ fontSize: '.8rem', textTransform: 'none' }}>
                                            {isDepartmentalTaskTable
                                                ? (task.activity_title || task.title || DEPT_INTERNAL_LABEL)
                                                : (isContainerProcess ? `${task.title} (Sub-tasks)` : task.title)}
                                        </td>
                                        {!isDepartmentalTaskTable && (
                                            <td
                                                style={{ fontSize: '.8rem', maxWidth: '200px', textTransform: 'none' }}
                                                className="text-dark small fw-normal"
                                            >
                                                {task.performance_indicator?.trim() ? task.performance_indicator : '—'}
                                            </td>
                                        )}
                                        {!isDepartmentalTaskTable && (
                                            <td className="small text-dark fw-normal" style={{ fontSize: '.8rem', textTransform: 'none' }}>
                                                {task.activity_title || DEPT_INTERNAL_LABEL}
                                            </td>
                                        )}
                                        <td className="text-dark fw-normal" style={{ fontSize: '.8rem', textTransform: 'none' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="staff-avatar" style={{
                                                    background: 'var(--mubs-blue)',
                                                    width: '28px',
                                                    height: '28px',
                                                    fontSize: '.7rem',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    fontWeight: 500,
                                                    textTransform: 'none',
                                                }} title={isContainerProcess ? 'Sub-tasks assigned' : staffAssigneeTitle(task.assignee_name, UNASSIGNED_LABEL)}>
                                                    {staffAssigneeInitials(task.assignee_name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="text-truncate">
                                                            {isContainerProcess ? 'Sub-tasks' : staffAssigneeShortLabel(task.assignee_name, UNASSIGNED_LABEL)}
                                                        </span>
                                                        {isContainerProcess && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs btn-outline-secondary py-0 px-2 fw-bold"
                                                                style={{ fontSize: '.7rem' }}
                                                                onClick={() =>
                                                                    setExpandedProcessAssignmentIds((prev) => ({
                                                                        ...prev,
                                                                        [task.id]: !prev[task.id],
                                                                    }))
                                                                }
                                                                title={expanded ? 'Hide sub-tasks' : 'Show sub-tasks'}
                                                            >
                                                                {expanded ? 'Hide' : 'View'} ({subtasks.length})
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isContainerProcess && subtasks.length > 0 && (
                                                        <div className="text-muted" style={{ fontSize: '.72rem' }}>
                                                            {subtasks
                                                                .slice(0, 2)
                                                                .map((s) => s.assigned_to_name || `Staff #${s.assigned_to}`)
                                                                .join(', ')}
                                                            {subtasks.length > 2 ? ` +${subtasks.length - 2} more` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="small text-dark fw-normal" style={{ fontSize: '.75rem', textTransform: 'none' }}>
                                            {getProcessDueFootnote(task)}
                                        </td>

                                        <td style={{ minWidth: '120px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress w-100" style={{ height: '6px', borderRadius: '10px' }}>
                                                    <div className="progress-bar" style={{
                                                        width: `${task.progress || 0}%`,
                                                        background: (task.progress || 0) > 70 ? '#10b981' : ((task.progress || 0) > 30 ? '#f59e0b' : '#3b82f6'),
                                                        borderRadius: '10px'
                                                    }}></div>
                                                </div>
                                                <span className="small fw-normal text-dark" style={{ fontSize: '.75rem', textTransform: 'none' }}>{task.progress || 0}%</span>
                                            </div>
                                        </td>
                                        <td
                                            className="small fw-normal"
                                            style={{
                                                fontSize: '.8rem',
                                                textTransform: 'none',
                                                color:
                                                    task.status === 'Completed'
                                                        ? '#15803d'
                                                        : task.status === 'In Progress'
                                                          ? '#a16207'
                                                          : task.status === 'Under Review'
                                                            ? '#1d4ed8'
                                                            : task.status === 'Not opened'
                                                              ? '#9a3412'
                                                              : '#475569',
                                            }}
                                        >
                                            {task.status}
                                        </td>
                                        <td className="pe-4 text-end">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-1 px-2 fw-bold text-nowrap"
                                                style={{ fontSize: '.75rem', borderRadius: '8px' }}
                                                onClick={() => setTableDetailsTask(task)}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                                                View details
                                            </button>
                                        </td>
                                    </tr>
                                    {isContainerProcess && expanded && (
                                        <tr key={`subtasks-${task.id}-${idx}`}>
                                            <td colSpan={isDepartmentalTaskTable ? 7 : 9} className="ps-4 pe-4 py-2" style={{ background: '#f8fafc' }}>
                                                {subtasks.length === 0 ? (
                                                    <div className="text-muted small">No sub-tasks found for this process.</div>
                                                ) : (
                                                    <div className="d-flex flex-column gap-2">
                                                        {subtasks.map((s) => (
                                                            <div key={s.id} className="d-flex align-items-center justify-content-between gap-3 p-2 rounded-3 bg-white border">
                                                                <div className="min-w-0 flex-grow-1">
                                                                    <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '.82rem' }}>
                                                                        {s.title}
                                                                    </div>
                                                                    <div className="text-muted text-truncate" style={{ fontSize: '.72rem' }}>
                                                                        {s.assigned_to_name || `Staff #${s.assigned_to}`}
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-3 flex-shrink-0">
                                                                    <div className="d-flex align-items-center gap-2" style={{ minWidth: '110px' }}>
                                                                        <div className="progress flex-grow-1" style={{ height: '6px', borderRadius: '10px' }}>
                                                                            <div
                                                                                className="progress-bar"
                                                                                style={{
                                                                                    width: `${subtaskProgress(s.status)}%`,
                                                                                    background:
                                                                                        subtaskProgress(s.status) >= 70
                                                                                            ? '#10b981'
                                                                                            : subtaskProgress(s.status) >= 30
                                                                                              ? '#f59e0b'
                                                                                              : '#3b82f6',
                                                                                    borderRadius: '10px',
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                        <span className="text-muted fw-bold" style={{ fontSize: '.72rem', minWidth: '32px', textAlign: 'right' }}>
                                                                            {subtaskProgress(s.status)}%
                                                                        </span>
                                                                    </div>
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            background:
                                                                                String(s.status).toLowerCase() === 'completed' || String(s.status).toLowerCase() === 'evaluated'
                                                                                    ? '#dcfce7'
                                                                                    : String(s.status).toLowerCase() === 'submitted'
                                                                                      ? '#fef9c3'
                                                                                      : '#e0f2fe',
                                                                            color:
                                                                                String(s.status).toLowerCase() === 'completed' || String(s.status).toLowerCase() === 'evaluated'
                                                                                    ? '#15803d'
                                                                                    : String(s.status).toLowerCase() === 'submitted'
                                                                                      ? '#a16207'
                                                                                      : '#0369a1',
                                                                            fontSize: '.7rem',
                                                                        }}
                                                                    >
                                                                        {s.status || 'pending'}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-0 px-2 fw-bold"
                                                                        style={{ fontSize: '.72rem', borderRadius: '8px' }}
                                                                        title={
                                                                            subtaskStatusBlocksReassign(s.status)
                                                                                ? 'Cannot reassign completed sub-tasks'
                                                                                : 'Reassign this sub-task'
                                                                        }
                                                                        disabled={subtaskStatusBlocksReassign(s.status)}
                                                                        onClick={() =>
                                                                            setReassignSubtaskCtx({
                                                                                assignmentId: task.id,
                                                                                subtask: s,
                                                                                parentProcessTitle: task.title,
                                                                                activityTitle:
                                                                                    task.activity_title || DEPT_INTERNAL_LABEL,
                                                                            })
                                                                        }
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>swap_horiz</span>
                                                                        Reassign
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                    </>
                                    );
                                })
                            )}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Footer: pagination (table/grid, staff-style; hidden when no rows) */}
                {viewMode !== 'activity' && filteredTasks.length > 0 && (
                    <div
                        className="p-4 border-top d-flex justify-content-between align-items-center flex-wrap gap-3 bg-white"
                        style={{ borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}
                    >
                        <div className="text-muted fw-bold" style={{ fontSize: '0.75rem' }}>
                            Showing <span className="text-dark">{startIndex + 1}</span> to{' '}
                            <span className="text-dark">{Math.min(startIndex + pagedTasks.length, filteredTasks.length)}</span> of{' '}
                            <span className="text-dark">{filteredTasks.length}</span> processes
                        </div>
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            <div className="d-flex align-items-center gap-2">
                                <span className="text-muted fw-bold" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                    Rows per page:
                                </span>
                                <select
                                    className="form-select form-select-sm border"
                                    style={{ width: '70px', borderRadius: '8px', fontSize: '0.75rem' }}
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                            <div className="pagination-controls d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        opacity: safePage === 1 ? 0.5 : 1,
                                    }}
                                    disabled={safePage === 1}
                                    onClick={() => {
                                        setCurrentPage((prev) => Math.max(1, prev - 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        type="button"
                                        className={`btn btn-sm fw-bold d-flex align-items-center justify-content-center p-0 ${
                                            safePage === i + 1 ? 'btn-primary shadow-sm' : 'btn-outline-light border text-dark'
                                        }`}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            transition: 'all 0.2s',
                                        }}
                                        onClick={() => {
                                            setCurrentPage(i + 1);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light border text-dark d-flex align-items-center justify-content-center p-0"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        opacity: safePage === totalPages || totalPages === 0 ? 0.5 : 1,
                                    }}
                                    disabled={safePage === totalPages || totalPages === 0}
                                    onClick={() => {
                                        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {tableDetailsTask && (
                <div
                    className="modal-backdrop fade show"
                    style={{ zIndex: 1048, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)' }}
                    onClick={() => setTableDetailsTask(null)}
                />
            )}
            <div
                className={`modal fade ${tableDetailsTask ? 'show d-block' : ''}`}
                tabIndex={-1}
                style={{ zIndex: 1049 }}
                aria-hidden={!tableDetailsTask}
            >
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '440px' }}>
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        {tableDetailsTask && (
                            <>
                                <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                                    <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0" style={{ fontSize: '1.05rem' }}>
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>checklist</span>
                                        Process details
                                    </h6>
                                    <button type="button" className="btn-close" onClick={() => setTableDetailsTask(null)} aria-label="Close" />
                                </div>
                                <div className="modal-body px-4 pt-2 pb-3">
                                    <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '1rem', lineHeight: 1.35 }}>
                                        {tableDetailsTask.title}
                                    </h5>
                                    <dl className="row mb-0 small" style={{ fontSize: '0.82rem' }}>
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Performance indicator
                                        </dt>
                                        <dd className="col-7 mb-2 text-dark" style={{ textTransform: 'none' }}>
                                            {tableDetailsTask.performance_indicator?.trim() ? tableDetailsTask.performance_indicator : '—'}
                                        </dd>
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Strategic activity
                                        </dt>
                                        <dd className="col-7 mb-2 text-dark" style={{ textTransform: 'none' }}>
                                            {tableDetailsTask.activity_title || DEPT_INTERNAL_LABEL}
                                        </dd>
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Staff assigned
                                        </dt>
                                        <dd className="col-7 mb-2 text-dark d-flex align-items-center gap-2" style={{ textTransform: 'none' }}>
                                            <div
                                                className="staff-avatar flex-shrink-0"
                                                style={{
                                                    background: 'var(--mubs-blue)',
                                                    width: '28px',
                                                    height: '28px',
                                                    fontSize: '.7rem',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    fontWeight: 500,
                                                }}
                                                title={staffAssigneeTitle(tableDetailsTask.assignee_name, UNASSIGNED_LABEL)}
                                            >
                                                {staffAssigneeInitials(tableDetailsTask.assignee_name)}
                                            </div>
                                            <span>{staffAssigneeTitle(tableDetailsTask.assignee_name, UNASSIGNED_LABEL)}</span>
                                        </dd>
                                        {(tableDetailsTask.startDate || tableDetailsTask.endDate) && (
                                            <>
                                                <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                                    Window
                                                </dt>
                                                <dd className="col-7 mb-2 text-dark">
                                                    {formatDate(tableDetailsTask.startDate || '')} — {formatDate(tableDetailsTask.endDate || '')}
                                                </dd>
                                            </>
                                        )}
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Due / time left
                                        </dt>
                                        <dd className="col-7 mb-2 text-dark">
                                            {tableDetailsTask.tier === 'process_task'
                                                ? getProcessDueFootnote(tableDetailsTask)
                                                : formatDate(tableDetailsTask.dueDate)}
                                        </dd>
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Progress
                                        </dt>
                                        <dd className="col-7 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-grow-1" style={{ height: '6px', borderRadius: '10px' }}>
                                                    <div
                                                        className="progress-bar"
                                                        style={{
                                                            width: `${tableDetailsTask.progress || 0}%`,
                                                            background:
                                                                (tableDetailsTask.progress || 0) > 70
                                                                    ? '#10b981'
                                                                    : (tableDetailsTask.progress || 0) > 30
                                                                      ? '#f59e0b'
                                                                      : '#3b82f6',
                                                            borderRadius: '10px',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-dark fw-semibold" style={{ fontSize: '0.75rem' }}>
                                                    {tableDetailsTask.progress || 0}%
                                                </span>
                                            </div>
                                        </dd>
                                        <dt className="col-5 text-muted text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                            Status
                                        </dt>
                                        <dd className="col-7 mb-0">
                                            <span
                                                className="fw-semibold"
                                                style={{
                                                    fontSize: '0.8rem',
                                                    color:
                                                        tableDetailsTask.status === 'Completed'
                                                            ? '#15803d'
                                                            : tableDetailsTask.status === 'In Progress'
                                                              ? '#a16207'
                                                              : tableDetailsTask.status === 'Under Review'
                                                                ? '#1d4ed8'
                                                                : tableDetailsTask.status === 'Not opened'
                                                                  ? '#9a3412'
                                                                  : '#475569',
                                                }}
                                            >
                                                {tableDetailsTask.status}
                                            </span>
                                        </dd>
                                    </dl>

                                    {tableDetailsTask.status === 'Completed' && (
                                        <div className="border-top pt-3 mt-3">
                                            <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                                Submission & review record
                                            </p>
                                            {tableDetailsReviewLoading ? (
                                                <div className="d-flex align-items-center gap-2 text-muted small">
                                                    <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
                                                    Loading review…
                                                </div>
                                            ) : !tableDetailsReview ? (
                                                <div className="text-muted small">
                                                    No submission/review record found for this process.
                                                </div>
                                            ) : (
                                                <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                    <div className="d-flex align-items-start justify-content-between gap-2">
                                                        <div className="flex-grow-1">
                                                            <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>
                                                                {tableDetailsReview.report_name}
                                                            </div>
                                                            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                                {tableDetailsReview.submitted_at ? formatEvaluationModalDate(tableDetailsReview.submitted_at) : '—'}
                                                            </div>
                                                        </div>
                                                        <div className="text-end">
                                                            <div className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                                                                DECISION
                                                            </div>
                                                            <div className="fw-bold" style={{ fontSize: '0.78rem', color: '#15803d' }}>
                                                                {getRatingLabel(tableDetailsReview)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {tableDetailsReview.report_summary ? (
                                                        <div className="mt-3 pt-3 border-top border-light">
                                                            <div className="fw-semibold text-dark mb-1" style={{ fontSize: '0.75rem' }}>
                                                                Submission summary
                                                            </div>
                                                            <div className="text-secondary small" style={{ whiteSpace: 'pre-wrap' }}>
                                                                {tableDetailsReview.report_summary}
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {parseEvidenceItems(tableDetailsReview.attachments).length > 0 ? (
                                                        <div className="mt-3 pt-3 border-top border-light">
                                                            <div className="fw-semibold text-dark mb-2" style={{ fontSize: '0.75rem' }}>
                                                                Evidence
                                                            </div>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {parseEvidenceItems(tableDetailsReview.attachments).map((ev, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                                        style={{ borderRadius: 8 }}
                                                                        onClick={() => {
                                                                            try {
                                                                                window.open(ev.url, '_blank', 'noopener,noreferrer');
                                                                            } catch {}
                                                                        }}
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                                                                        {ev.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    <div className="mt-3 pt-3 border-top border-light">
                                                        <div className="fw-semibold text-dark mb-1" style={{ fontSize: '0.75rem' }}>
                                                            Feedback
                                                        </div>
                                                        <div className="text-dark small" style={{ whiteSpace: 'pre-wrap' }}>
                                                            {tableDetailsReview.reviewer_notes ? tableDetailsReview.reviewer_notes : 'No feedback.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {tableDetailsTask.tier === 'process_task' &&
                                        (tableDetailsTask.assigned_to == null ||
                                            String(tableDetailsTask.assignee_name || '').trim() === '') && (
                                            <div className="border-top pt-3 mt-3">
                                                <p
                                                    className="text-muted text-uppercase fw-bold mb-2"
                                                    style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}
                                                >
                                                    Sub-tasks
                                                </p>
                                                {(subtasksByProcessAssignmentId[tableDetailsTask.id] || []).length ===
                                                0 ? (
                                                    <div className="text-muted small">No sub-tasks for this process.</div>
                                                ) : (
                                                    <div className="d-flex flex-column gap-2">
                                                        {(subtasksByProcessAssignmentId[tableDetailsTask.id] || []).map(
                                                            (s) => (
                                                                <div
                                                                    key={s.id}
                                                                    className="d-flex align-items-center justify-content-between gap-2 flex-wrap p-2 rounded-3 bg-light border"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <div
                                                                            className="fw-semibold text-dark"
                                                                            style={{ fontSize: '0.82rem' }}
                                                                        >
                                                                            {s.title}
                                                                        </div>
                                                                        <div className="text-muted small">
                                                                            {s.assigned_to_name ||
                                                                                `Staff #${s.assigned_to}`}{' '}
                                                                            <span className="badge bg-secondary-subtle text-secondary ms-1">
                                                                                {s.status || 'pending'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                                                        style={{ fontSize: '.72rem', borderRadius: '8px' }}
                                                                        disabled={subtaskStatusBlocksReassign(s.status)}
                                                                        onClick={() =>
                                                                            setReassignSubtaskCtx({
                                                                                assignmentId: tableDetailsTask.id,
                                                                                subtask: s,
                                                                                parentProcessTitle: tableDetailsTask.title,
                                                                                activityTitle:
                                                                                    tableDetailsTask.activity_title ||
                                                                                    DEPT_INTERNAL_LABEL,
                                                                            })
                                                                        }
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>swap_horiz</span>
                                                                        Reassign
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    {tableDetailsTask.status !== 'Completed' && (
                                        <div className="border-top pt-3 mt-3">
                                            <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                                Actions
                                            </p>
                                            {renderProcessTaskModalActions(tableDetailsTask)}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {openProcessTask && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => !openProcessSaving && setOpenProcessTask(null)} />
            )}
            <div
                className={`modal fade ${openProcessTask ? 'show d-block' : ''}`}
                tabIndex={-1}
                style={{ zIndex: 1050 }}
                aria-hidden={!openProcessTask}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-success" style={{ fontSize: '24px' }}>event_available</span>
                                Open process
                            </h6>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => !openProcessSaving && setOpenProcessTask(null)}
                                disabled={openProcessSaving}
                            />
                        </div>
                        {openProcessTask && (
                            <div className="modal-body p-4 pt-2">
                                <div className="p-3 rounded-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <dl className="row mb-0 small">
                                        <dt className="col-sm-4 text-muted fw-bold" style={{ fontSize: '0.72rem' }}>
                                            Process task
                                        </dt>
                                        <dd className="col-sm-8 mb-2 text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>
                                            {openProcessTask.title}
                                        </dd>
                                        <dt className="col-sm-4 text-muted fw-bold" style={{ fontSize: '0.72rem' }}>
                                            Strategic activity
                                        </dt>
                                        <dd className="col-sm-8 mb-2 text-dark" style={{ fontSize: '0.82rem' }}>
                                            {openProcessTask.activity_title || DEPT_INTERNAL_LABEL}
                                        </dd>
                                        <dt className="col-sm-4 text-muted fw-bold" style={{ fontSize: '0.72rem' }}>
                                            Assigned staff
                                        </dt>
                                        <dd className="col-sm-8 mb-2 text-dark" style={{ fontSize: '0.82rem' }}>
                                            {staffAssigneeTitle(openProcessTask.assignee_name, UNASSIGNED_LABEL)}
                                        </dd>
                                        {openProcessTask.performance_indicator?.trim() ? (
                                            <>
                                                <dt className="col-sm-4 text-muted fw-bold" style={{ fontSize: '0.72rem' }}>
                                                    Performance indicator
                                                </dt>
                                                <dd className="col-sm-8 mb-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                                                    {openProcessTask.performance_indicator}
                                                </dd>
                                            </>
                                        ) : null}
                                        <dt className="col-sm-4 text-muted fw-bold" style={{ fontSize: '0.72rem' }}>
                                            Duration
                                        </dt>
                                        <dd className="col-sm-8 mb-0 text-dark" style={{ fontSize: '0.82rem' }}>
                                            {formatStandardProcessDuration(
                                                openProcessTask.duration_value ?? null,
                                                openProcessTask.duration_unit ?? null
                                            ) || '—'}
                                        </dd>
                                    </dl>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted mb-1">Start date</label>
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={openProcessStart}
                                        onChange={(e) => setOpenProcessStart(e.target.value)}
                                        disabled={openProcessSaving}
                                    />
                                </div>
                                <div className="mb-4 p-2 rounded-2 border bg-light">
                                    <div className="small text-muted fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                                        End date
                                    </div>
                                    <div className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                                        {openProcessComputedDue
                                            ? formatDateWithYear(openProcessComputedDue)
                                            : openProcessTask.duration_value == null ||
                                                !String(openProcessTask.duration_unit || '').trim()
                                              ? 'Duration missing on standard — contact admin'
                                              : '—'}
                                    </div>
                                </div>
                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-light border fw-bold px-3"
                                        style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                        onClick={() => setOpenProcessTask(null)}
                                        disabled={openProcessSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success fw-bold px-3 shadow-sm"
                                        style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                        onClick={handleSubmitOpenProcess}
                                        disabled={openProcessSaving}
                                    >
                                        {openProcessSaving ? 'Saving…' : 'Open process'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showBulkOpenModal && (
                <div
                    className="modal-backdrop fade show"
                    style={{ zIndex: 1042 }}
                    onClick={() => !bulkOpenSaving && setShowBulkOpenModal(false)}
                />
            )}
            <div
                className={`modal fade ${showBulkOpenModal ? 'show d-block' : ''}`}
                tabIndex={-1}
                style={{ zIndex: 1052 }}
                aria-hidden={!showBulkOpenModal}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
                                <span className="material-symbols-outlined text-success" style={{ fontSize: '24px' }}>event_available</span>
                                Open selected processes
                            </h6>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => !bulkOpenSaving && setShowBulkOpenModal(false)}
                                disabled={bulkOpenSaving}
                            />
                        </div>
                        <div className="modal-body p-4 pt-2">
                            <p className="text-muted small mb-3" style={{ fontSize: '0.88rem' }}>
                                This will open <strong>{selectedTaskIds.length}</strong> selected process(es) and set the same start date for all.
                            </p>
                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted mb-1">Start date</label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={bulkOpenStart}
                                    onChange={(e) => setBulkOpenStart(e.target.value)}
                                    disabled={bulkOpenSaving}
                                />
                            </div>
                            <div className="d-flex justify-content-end gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light border fw-bold px-3"
                                    style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                    onClick={() => setShowBulkOpenModal(false)}
                                    disabled={bulkOpenSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success fw-bold px-3 shadow-sm"
                                    style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                    onClick={handleSubmitBulkOpen}
                                    disabled={bulkOpenSaving}
                                >
                                    {bulkOpenSaving ? 'Opening…' : 'Open processes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {reassignTask && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1041 }} onClick={() => !reassignSaving && setReassignTask(null)} />
            )}
            <div
                className={`modal fade ${reassignTask ? 'show d-block' : ''}`}
                tabIndex={-1}
                style={{ zIndex: 1051 }}
                aria-hidden={!reassignTask}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-secondary" style={{ fontSize: '24px' }}>swap_horiz</span>
                                Reassign process (task)
                            </h6>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => !reassignSaving && setReassignTask(null)}
                                disabled={reassignSaving}
                            />
                        </div>
                        {reassignTask && (
                            <div className="modal-body p-4 pt-2">
                                <p className="text-muted small mb-3" style={{ fontSize: '0.88rem' }}>
                                    <strong className="text-dark">{reassignTask.title}</strong>
                                    <br />
                                    Current assignee: {reassignTask.assignee_name || UNASSIGNED_LABEL}. Dates will be cleared; open the process again for the new assignee.
                                </p>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted mb-1">New assignee</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={reassignStaffId === '' ? '' : String(reassignStaffId)}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setReassignStaffId(v === '' ? '' : Number(v));
                                        }}
                                        disabled={reassignSaving}
                                    >
                                        <option value="">Select staff…</option>
                                        {departmentUsers
                                            .filter((u) => u.id !== reassignTask.assigned_to)
                                            .map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name}
                                                    {u.position ? ` — ${u.position}` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted mb-1">Reason</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={reassignReasonCode}
                                        onChange={(e) => setReassignReasonCode(e.target.value)}
                                        disabled={reassignSaving}
                                    >
                                        <option value="">Select a reason…</option>
                                        {PROCESS_REASSIGN_REASONS.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-muted mb-1">
                                        Additional details <span className="fw-normal text-muted">(optional)</span>
                                    </label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows={3}
                                        placeholder={
                                            reassignReasonCode === 'other'
                                                ? 'Describe the reason (required for “Other”)…'
                                                : 'Optional context for the assignees…'
                                        }
                                        value={reassignDescription}
                                        onChange={(e) => setReassignDescription(e.target.value)}
                                        disabled={reassignSaving}
                                    />
                                    {reassignReasonCode === 'other' ? (
                                        <div className="form-text" style={{ fontSize: '0.72rem' }}>
                                            “Other” requires a short description above.
                                        </div>
                                    ) : null}
                                </div>
                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-light border fw-bold px-3"
                                        style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                        onClick={() => setReassignTask(null)}
                                        disabled={reassignSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary fw-bold px-3 shadow-sm"
                                        style={{ fontSize: '0.75rem', borderRadius: '8px', background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' }}
                                        onClick={handleSubmitReassign}
                                        disabled={reassignSaving}
                                    >
                                        {reassignSaving ? 'Saving…' : 'Reassign'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {reassignSubtaskCtx && (
                <div
                    className="modal-backdrop fade show"
                    style={{ zIndex: 1052 }}
                    onClick={() => !reassignSubtaskSaving && setReassignSubtaskCtx(null)}
                />
            )}
            <div
                className={`modal fade ${reassignSubtaskCtx ? 'show d-block' : ''}`}
                tabIndex={-1}
                style={{ zIndex: 1053 }}
                aria-hidden={!reassignSubtaskCtx}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-secondary" style={{ fontSize: '24px' }}>swap_horiz</span>
                                Reassign sub-task
                            </h6>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => !reassignSubtaskSaving && setReassignSubtaskCtx(null)}
                                disabled={reassignSubtaskSaving}
                            />
                        </div>
                        {reassignSubtaskCtx && (
                            <div className="modal-body p-4 pt-2">
                                <p className="text-muted small mb-3" style={{ fontSize: '0.88rem' }}>
                                    <strong className="text-dark">{reassignSubtaskCtx.subtask.title}</strong>
                                    <br />
                                    Under process:{' '}
                                    <span className="text-dark">{reassignSubtaskCtx.parentProcessTitle}</span>
                                    <br />
                                    Activity: {reassignSubtaskCtx.activityTitle}
                                    <br />
                                    Current assignee:{' '}
                                    {reassignSubtaskCtx.subtask.assigned_to_name ||
                                        `Staff #${reassignSubtaskCtx.subtask.assigned_to}`}
                                    . Reports for this sub-task will be cleared for the new assignee.
                                </p>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted mb-1">New assignee</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={reassignSubtaskStaffId === '' ? '' : String(reassignSubtaskStaffId)}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setReassignSubtaskStaffId(v === '' ? '' : Number(v));
                                        }}
                                        disabled={reassignSubtaskSaving}
                                    >
                                        <option value="">Select staff…</option>
                                        {departmentUsers
                                            .filter((u) => u.id !== reassignSubtaskCtx.subtask.assigned_to)
                                            .map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name}
                                                    {u.position ? ` — ${u.position}` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted mb-1">Reason</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={reassignSubtaskReasonCode}
                                        onChange={(e) => setReassignSubtaskReasonCode(e.target.value)}
                                        disabled={reassignSubtaskSaving}
                                    >
                                        <option value="">Select a reason…</option>
                                        {PROCESS_REASSIGN_REASONS.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-muted mb-1">
                                        Additional details <span className="fw-normal text-muted">(optional)</span>
                                    </label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows={3}
                                        placeholder={
                                            reassignSubtaskReasonCode === 'other'
                                                ? 'Describe the reason (required for “Other”)…'
                                                : 'Optional context for the assignees…'
                                        }
                                        value={reassignSubtaskDescription}
                                        onChange={(e) => setReassignSubtaskDescription(e.target.value)}
                                        disabled={reassignSubtaskSaving}
                                    />
                                    {reassignSubtaskReasonCode === 'other' ? (
                                        <div className="form-text" style={{ fontSize: '0.72rem' }}>
                                            “Other” requires a short description above.
                                        </div>
                                    ) : null}
                                </div>
                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-light border fw-bold px-3"
                                        style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                                        onClick={() => setReassignSubtaskCtx(null)}
                                        disabled={reassignSubtaskSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary fw-bold px-3 shadow-sm"
                                        style={{
                                            fontSize: '0.75rem',
                                            borderRadius: '8px',
                                            background: 'var(--mubs-blue)',
                                            borderColor: 'var(--mubs-blue)',
                                        }}
                                        onClick={handleSubmitReassignSubtask}
                                        disabled={reassignSubtaskSaving}
                                    >
                                        {reassignSubtaskSaving ? 'Saving…' : 'Reassign'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Delete Confirmation Modal UI */}
            {showBulkDeleteModal && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
            )}
            <div className={`modal fade ${showBulkDeleteModal ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-danger" style={{ fontSize: '24px' }}>person_remove</span>
                                Unassign Processes
                            </h6>
                            <button type="button" className="btn-close" onClick={() => setShowBulkDeleteModal(false)}></button>
                        </div>
                        <div className="modal-body p-4 pt-3">
                            <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
                                Remove <strong>{selectedTaskIds.length}</strong> assigned process{selectedTaskIds.length !== 1 ? 'es' : ''}? This will unassign the staff member from the activity.
                            </p>
                            
                            {bulkDeleteError && (
                                <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger d-flex align-items-center p-2 mb-3" style={{ fontSize: '0.85rem' }}>
                                    <span className="material-symbols-outlined me-2" style={{ fontSize: '18px' }}>error</span>
                                    {bulkDeleteError}
                                </div>
                            )}

                            <div className="d-flex justify-content-end gap-2">
                                <button type="button" className="btn btn-sm btn-light border fw-bold px-3" style={{ fontSize: '0.75rem', borderRadius: '8px' }} onClick={() => setShowBulkDeleteModal(false)} disabled={isBulkDeleting}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-sm btn-danger fw-bold px-3 shadow-sm" style={{ fontSize: '0.75rem', borderRadius: '8px' }} onClick={handleBulkDelete} disabled={isBulkDeleting}>
                                    {isBulkDeleting ? 'Unassigning...' : 'Unassign All'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* In-Page Evaluation Modals */}
            {(evaluateModalItem || viewModalItem || isEvaluationLoading) && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1060, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}></div>
            )}

            {/* 1. View Details Modal */}
            <div className={`modal fade ${viewModalItem ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1070 }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                        <div className="modal-header border-bottom-0 pb-0 px-4 pt-4">
                            <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>description</span>
                                Evaluation Record
                            </h6>
                            <button type="button" className="btn-close" onClick={() => setViewModalItem(null)}></button>
                        </div>
                        {viewModalItem && (
                            <div className="modal-body p-4">
                                <div className="p-3 rounded-3 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                                        <div className="flex-fill">
                                            <div className="d-flex align-items-center gap-3 mb-2">
                                                <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>{viewModalItem.report_name}</div>
                                                <span className="badge" style={{
                                                    background: viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2',
                                                    color: viewModalItem.status === 'Completed' ? '#15803d' : '#b91c1c',
                                                    fontSize: '.75rem',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px'
                                                }}>{viewModalItem.status === 'Completed' ? 'Accepted' : 'Returned'}</span>
                                            </div>
                                            <div className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>category</span>
                                                {viewModalItem.activity_title}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }}>person</span>
                                                {viewModalItem.staff_name} &middot; {formatDate(viewModalItem.submitted_at)}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-4 mt-3 pt-3 border-top w-100">
                                            <div className="flex-grow-1">
                                                <div className="text-dark fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '.05em' }}>REPORTED PROGRESS</div>
                                                <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                                                    <div className="progress-bar bg-primary" style={{ width: `${viewModalItem.progress || 0}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="fw-black text-primary" style={{ fontSize: '1.1rem' }}>{viewModalItem.progress || 0}%</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-semibold mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>subject</span>
                                        Report Summary
                                    </label>
                                    <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <p className="mb-0 text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                            {viewModalItem.report_summary || 'No summary provided.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3" style={{ 
                                    background: viewModalItem.status === 'Completed' ? '#f0fdf4' : '#fff1f2', 
                                    border: `1px solid ${viewModalItem.status === 'Completed' ? '#dcfce7' : '#fee2e2'}` 
                                }}>
                                    <div className="row g-3 align-items-center">
                                        <div className="col-4 text-center border-end">
                                            <div className="fw-black text-dark" style={{ fontSize: '1.4rem', lineHeight: '1' }}>{viewModalItem.score ?? '-'}</div>
                                            <div className="text-muted fw-bold mt-2" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>RATING</div>
                                            <div className="fw-bold mt-2" style={{ 
                                                fontSize: '0.8rem',
                                                color: getRatingLabel(viewModalItem).startsWith('Complete') ? '#15803d' : (getRatingLabel(viewModalItem) === 'Not Done' ? '#64748b' : '#b45309')
                                            }}>
                                                {getRatingLabel(viewModalItem)}
                                            </div>
                                        </div>
                                        <div className="col-8 ps-4">
                                            <div className="fw-bold text-dark mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                                <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>forum</span>
                                                Feedback
                                            </div>
                                            <p className="mb-0 text-dark italic" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                                                {viewModalItem.reviewer_notes ? `"${viewModalItem.reviewer_notes}"` : 'No feedback.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <EvaluateSubmissionModal
                item={evaluateModalItem}
                open={!!evaluateModalItem}
                onClose={() => !isSubmitting && setEvaluateModalItem(null)}
                formatDate={formatEvaluationModalDate}
                selectedRating={selectedRating}
                onSelectRating={(id, rating) => setSelectedRating((prev) => ({ ...prev, [id]: rating }))}
                comments={evaluationComments}
                onCommentChange={(id, comment) => setEvaluationComments((prev) => ({ ...prev, [id]: comment }))}
                kpiActualValues={kpiActualValues}
                onKpiActualChange={(id, value) => setKpiActualValues((prev) => ({ ...prev, [id]: value }))}
                onSubmit={handleSubmitEvaluation}
                isSubmitting={isSubmitting}
                zIndex={1070}
                feedbackHistory={feedbackHistoryForReview}
            />

            {/* Loading Spinner for Evaluation Fetch */}
            {isEvaluationLoading && (
                <div className="position-fixed top-50 start-50 translate-middle" style={{ zIndex: 1080 }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {/* 4. Message/Alert Modal */}
            {messageModal.show && (
                <div className="modal-backdrop fade show" style={{ zIndex: 1100, background: 'rgba(15, 23, 42, 0.4)' }}></div>
            )}
            <div className={`modal fade ${messageModal.show ? 'show d-block' : ''}`} tabIndex={-1} style={{ zIndex: 1110 }}>
                <div className="modal-dialog modal-dialog-centered modal-sm">
                    <div className="modal-content border-0 shadow-lg text-center" style={{ borderRadius: '16px' }}>
                        <div className="modal-body p-4">
                            <div className={`mb-3 d-inline-flex p-3 rounded-circle bg-opacity-10 bg-${messageModal.type === 'error' ? 'danger' : (messageModal.type === 'warning' ? 'warning' : 'primary')}`}>
                                <span className={`material-symbols-outlined fs-1 text-${messageModal.type === 'error' ? 'danger' : (messageModal.type === 'warning' ? 'warning' : 'primary')}`}>
                                    {messageModal.type === 'error' ? 'report' : (messageModal.type === 'warning' ? 'warning' : 'info')}
                                </span>
                            </div>
                            <h5 className="fw-bold text-dark mb-2">{messageModal.title}</h5>
                            <p className="text-secondary small mb-4" style={{ lineHeight: '1.5' }}>{messageModal.message}</p>
                            <button 
                                type="button" 
                                className="btn btn-primary w-100 fw-bold py-2" 
                                style={{ borderRadius: '10px' }}
                                onClick={() => setMessageModal({ ...messageModal, show: false })}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
