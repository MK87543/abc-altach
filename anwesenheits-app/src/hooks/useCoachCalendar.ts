import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach, CoachAbsence, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { useUrlQueryParam, getUrlParam, updateUrlParams } from '../lib/urlUtils'

export type CalendarViewMode = 'month' | 'week' | 'list'

export function useCoachCalendar() {
    const { toast } = useToast()
    const { confirm } = useConfirm()

    const [coaches, setCoaches] = useState<Coach[]>([])
    const [absences, setAbsences] = useState<CoachAbsence[]>([])
    const [trainings, setTrainings] = useState<Training[]>([])
    const [loading, setLoading] = useState(true)
    const [tableMissingWarning, setTableMissingWarning] = useState(false)

    // Ansichtseinstellungen mit URL-Query-Param Synchronisation (Refresh-Proof)
    const [viewMode, setViewMode] = useUrlQueryParam<CalendarViewMode>('calView', 'month')
    const [filterCoachId, setFilterCoachId] = useUrlQueryParam<string>('calCoach', 'all')

    const [currentDate, setCurrentDate] = useState<Date>(() => {
        const initialCalDate = getUrlParam('calDate')
        if (initialCalDate) {
            const parsed = new Date(initialCalDate)
            if (!isNaN(parsed.getTime())) return parsed
        }
        return new Date()
    })

    const updateCurrentDate = (dateOrUpdater: Date | ((prev: Date) => Date)) => {
        setCurrentDate(prev => {
            const next = typeof dateOrUpdater === 'function' ? dateOrUpdater(prev) : dateOrUpdater
            const iso = next.toISOString().split('T')[0]
            updateUrlParams({ calDate: iso }, true)
            return next
        })
    }

    async function loadCoaches() {
        const { data, error } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (error) {
            console.error('Fehler beim Laden der Trainer:', error)
        } else if (data) {
            setCoaches(data)
        }
    }

    async function loadTrainings() {
        const { data, error } = await supabase
            .from('trainings')
            .select('*')
            .order('date', { ascending: true })

        if (!error && data) {
            setTrainings(data)
        }
    }

    async function loadAbsences() {
        try {
            const { data, error } = await supabase
                .from('coach_absences')
                .select(`
                    *,
                    coaches:coach_id (
                        id,
                        name,
                        role,
                        active
                    )
                `)
                .order('start_date', { ascending: true })

            if (error) {
                if (
                    error.code === '42P01' ||
                    error.code === 'PGRST205' ||
                    error.message?.includes('coach_absences') ||
                    error.message?.includes('schema cache')
                ) {
                    setTableMissingWarning(true)
                    const cached = localStorage.getItem('abc_coach_absences_local')
                    if (cached) {
                        try {
                            setAbsences(JSON.parse(cached))
                        } catch {
                            setAbsences([])
                        }
                    }
                    return
                }
                console.error('Fehler beim Laden der Abwesenheiten:', error)
            } else if (data) {
                setAbsences(data as CoachAbsence[])
                setTableMissingWarning(false)
            }
        } catch (err) {
            console.warn('Unerwarteter Fehler beim Abrufen der Abwesenheiten:', err)
        }
    }

    async function loadAllData() {
        setLoading(true)
        try {
            await Promise.all([
                loadCoaches(),
                loadAbsences(),
                loadTrainings()
            ])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAllData()
    }, [])

    function saveLocally(payload: Partial<CoachAbsence>, editingId: string | null, selectedCoachId: string) {
        const existing = [...absences]
        if (editingId) {
            const idx = existing.findIndex(a => a.id === editingId)
            if (idx >= 0) {
                existing[idx] = {
                    ...existing[idx],
                    ...payload,
                    coaches: coaches.find(c => c.id === selectedCoachId) || existing[idx].coaches
                } as CoachAbsence
            }
        } else {
            const newEntry: CoachAbsence = {
                id: 'local-' + Date.now(),
                ...payload,
                created_at: new Date().toISOString(),
                coaches: coaches.find(c => c.id === selectedCoachId)
            } as CoachAbsence
            existing.push(newEntry)
        }
        setAbsences(existing)
        localStorage.setItem('abc_coach_absences_local', JSON.stringify(existing))
    }

    async function saveAbsence(
        payload: Partial<CoachAbsence>,
        editingId: string | null,
        selectedCoachId: string
    ): Promise<boolean> {
        if (tableMissingWarning) {
            saveLocally(payload, editingId, selectedCoachId)
            toast.success('Abwesenheit lokal gespeichert.')
            return true
        }

        if (editingId) {
            // Optimistische Aktualisierung
            setAbsences(prev => prev.map(a => a.id === editingId ? {
                ...a,
                ...payload,
                coaches: coaches.find(c => c.id === selectedCoachId) || a.coaches
            } as CoachAbsence : a))

            const { error } = await supabase
                .from('coach_absences')
                .update(payload)
                .eq('id', editingId)

            if (error) {
                if (
                    error.code === '42P01' ||
                    error.code === 'PGRST205' ||
                    error.code === '42501' ||
                    error.code === '42703' ||
                    error.message?.includes('coach_absences') ||
                    error.message?.includes('permission') ||
                    error.message?.includes('column') ||
                    error.message?.includes('schema cache')
                ) {
                    setTableMissingWarning(true)
                    saveLocally(payload, editingId, selectedCoachId)
                    toast.success('Abwesenheit lokal gespeichert.')
                    return true
                }
                console.error('Fehler beim Aktualisieren:', error)
                toast.error('Fehler beim Speichern: ' + error.message)
                await loadAbsences()
                return false
            } else {
                await loadAbsences()
                toast.success('Abwesenheit erfolgreich aktualisiert.')
                return true
            }
        } else {
            const { error } = await supabase
                .from('coach_absences')
                .insert([payload])

            if (error) {
                if (
                    error.code === '42P01' ||
                    error.code === 'PGRST205' ||
                    error.code === '42501' ||
                    error.code === '42703' ||
                    error.message?.includes('coach_absences') ||
                    error.message?.includes('permission') ||
                    error.message?.includes('column') ||
                    error.message?.includes('schema cache')
                ) {
                    setTableMissingWarning(true)
                    saveLocally(payload, editingId, selectedCoachId)
                    toast.success('Abwesenheit lokal gespeichert.')
                    return true
                }
                console.error('Fehler beim Einfügen:', error)
                toast.error('Fehler beim Speichern: ' + error.message)
                return false
            } else {
                await loadAbsences()
                toast.success('Abwesenheit erfolgreich eingetragen.')
                return true
            }
        }
    }

    async function deleteAbsence(id: string): Promise<boolean> {
        const confirmed = await confirm({
            title: 'Abwesenheit löschen',
            message: 'Möchtest du diese Abwesenheit wirklich löschen?',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) return false

        if (tableMissingWarning) {
            const updated = absences.filter(a => a.id !== id)
            setAbsences(updated)
            localStorage.setItem('abc_coach_absences_local', JSON.stringify(updated))
            toast.success('Abwesenheit gelöscht.')
            return true
        }

        const { error } = await supabase
            .from('coach_absences')
            .delete()
            .eq('id', id)

        if (error) {
            if (
                error.code === '42P01' ||
                error.code === 'PGRST205' ||
                error.message?.includes('coach_absences') ||
                error.message?.includes('schema cache')
            ) {
                setTableMissingWarning(true)
                const updated = absences.filter(a => a.id !== id)
                setAbsences(updated)
                localStorage.setItem('abc_coach_absences_local', JSON.stringify(updated))
                toast.success('Abwesenheit gelöscht.')
                return true
            }
            console.error('Fehler beim Löschen:', error)
            toast.error('Fehler beim Löschen: ' + error.message)
            return false
        } else {
            await loadAbsences()
            toast.success('Abwesenheit gelöscht.')
            return true
        }
    }

    // Monatsnavigation
    function prevMonth() {
        updateCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }

    function nextMonth() {
        updateCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    }

    function goToToday() {
        updateCurrentDate(new Date())
    }

    function setMonthYear(year: number, monthZeroIndexed: number) {
        updateCurrentDate(new Date(year, monthZeroIndexed, 1))
    }

    const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().split('T')[0])

    // Gefilterte Abwesenheiten nach Trainer
    const filteredAbsences = absences.filter(a => {
        if (filterCoachId === 'all') return true
        return a.coach_id === filterCoachId
    })

    return {
        coaches,
        absences,
        trainings,
        filteredAbsences,
        loading,
        tableMissingWarning,
        viewMode,
        setViewMode,
        filterCoachId,
        setFilterCoachId,
        currentDate,
        updateCurrentDate,
        prevMonth,
        nextMonth,
        goToToday,
        setMonthYear,
        selectedDateStr,
        setSelectedDateStr,
        saveAbsence,
        deleteAbsence,
        loadAllData
    }
}
