import { useState } from 'react'
import type { CoachAbsence, AbsenceType } from '../types/interfaces'
import { useActiveCoach } from '../hooks/useActiveCoach'
import { useCoachCalendar } from '../hooks/useCoachCalendar'
import { useToast } from '../components/Toast'
import { WarningIcon, SpinnerIcon } from '../components/Icons'
import {
    getDayOfWeekFromDateString,
    cleanReasonText
} from '../lib/absenceUtils'
import CalendarHeader from '../components/calendar/CalendarHeader'
import CalendarMonthView from '../components/calendar/CalendarMonthView'
import CalendarWeekView from '../components/calendar/CalendarWeekView'
import CalendarListView from '../components/calendar/CalendarListView'
import CoachAbsenceModal, { REASON_TILES } from '../components/calendar/CoachAbsenceModal'

interface CoachCalendarProps {
    onBack?: () => void
    hideHeader?: boolean
}

export default function CoachCalendar({ onBack, hideHeader }: CoachCalendarProps) {
    const { activeCoachId, setActiveCoach } = useActiveCoach()
    const { toast } = useToast()

    const {
        coaches,
        trainings,
        filteredAbsences,
        loading,
        tableMissingWarning,
        viewMode,
        setViewMode,
        filterCoachId,
        setFilterCoachId,
        currentDate,
        prevMonth,
        nextMonth,
        goToToday,
        setMonthYear,
        saveAbsence,
        deleteAbsence
    } = useCoachCalendar()

    // ── Modal-State für Abwesenheit (Einzeltag, Zeitraum, Wöchentlich) ──
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null)
    const [absenceMode, setAbsenceMode] = useState<'single' | 'range' | 'weekly'>('single')
    const [selectedCoachId, setSelectedCoachId] = useState<string>('')
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>('')
    const [recurringDays, setRecurringDays] = useState<number[]>([2])
    const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1)
    const [selectedReasonChip, setSelectedReasonChip] = useState<string>('Urlaub')
    const [customDetail, setCustomDetail] = useState<string>('')
    const [saving, setSaving] = useState(false)

    const toggleRecurringDay = (dayIdx: number) => {
        setRecurringDays(prev => {
            if (prev.includes(dayIdx)) {
                if (prev.length === 1) {
                    toast.info('Mindestens ein Wochentag muss ausgewählt bleiben.')
                    return prev
                }
                return prev.filter(d => d !== dayIdx)
            } else {
                const weekOrder = [1, 2, 3, 4, 5, 6, 0]
                return [...prev, dayIdx].sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b))
            }
        })
    }

    function openNewModal(presetDate?: string) {
        setEditingAbsenceId(null)
        setSelectedCoachId(activeCoachId || (coaches.length > 0 ? coaches[0].id : ''))
        setAbsenceMode('single')
        const initialDate = presetDate || new Date().toISOString().split('T')[0]
        setStartDate(initialDate)
        setEndDate('')
        const presetDay = getDayOfWeekFromDateString(initialDate)
        setRecurringDays([presetDay])
        setRecurrenceInterval(1)
        setSelectedReasonChip('Urlaub')
        setCustomDetail('')
        setIsModalOpen(true)
    }

    function openEditModal(absence: CoachAbsence) {
        setEditingAbsenceId(absence.id)
        setSelectedCoachId(absence.coach_id)
        const isRec = absence.absence_type === 'recurring'
        const isRng = !isRec && Boolean(absence.end_date && absence.end_date !== absence.start_date)

        if (isRec) {
            setAbsenceMode('weekly')
        } else if (isRng) {
            setAbsenceMode('range')
        } else {
            setAbsenceMode('single')
        }

        setStartDate(absence.start_date)
        setEndDate(absence.end_date || '')
        const days = (absence.recurring_days && absence.recurring_days.length > 0)
            ? absence.recurring_days
            : (absence.recurring_day_of_week !== null && absence.recurring_day_of_week !== undefined ? [absence.recurring_day_of_week] : [2])
        setRecurringDays(days)
        setRecurrenceInterval(absence.recurrence_interval || 1)

        const raw = cleanReasonText(absence.reason) || 'Urlaub'
        const matchingChip = REASON_TILES.find(t => raw.toLowerCase().startsWith(t.value.toLowerCase()))
        if (matchingChip) {
            setSelectedReasonChip(matchingChip.value)
            const rest = raw.slice(matchingChip.value.length).replace(/^[:\s-]+/, '')
            setCustomDetail(rest)
        } else {
            setSelectedReasonChip(raw ? 'Privat' : 'Urlaub')
            setCustomDetail(raw)
        }
        setIsModalOpen(true)
    }

    async function handleSave() {
        if (!selectedCoachId) {
            toast.warning('Bitte wähle einen Trainer aus.')
            return
        }
        if (!startDate) {
            toast.warning('Bitte wähle ein Datum aus.')
            return
        }

        const effectiveAbsenceType: AbsenceType = absenceMode === 'weekly'
            ? 'recurring'
            : (absenceMode === 'range' ? 'range' : 'single')

        if (effectiveAbsenceType === 'range') {
            if (!endDate) {
                toast.warning('Bitte wähle ein Enddatum aus.')
                return
            }
            if (endDate < startDate) {
                toast.warning('Das Enddatum kann nicht vor dem Startdatum liegen.')
                return
            }
        }
        if (effectiveAbsenceType === 'recurring' && recurringDays.length === 0) {
            toast.warning('Bitte wähle mindestens einen Wochentag aus.')
            return
        }

        setSaving(true)

        const finalReason = customDetail.trim()
            ? `${selectedReasonChip}: ${customDetail.trim()}`
            : selectedReasonChip
        const cleanedReason = cleanReasonText(finalReason)

        const payload: Partial<CoachAbsence> = {
            coach_id: selectedCoachId,
            absence_type: effectiveAbsenceType,
            start_date: startDate,
            end_date: effectiveAbsenceType === 'single' ? null : (endDate || null),
            recurring_day_of_week: effectiveAbsenceType === 'recurring' ? (recurringDays[0] ?? 2) : null,
            recurring_days: effectiveAbsenceType === 'recurring' ? recurringDays : null,
            recurrence_interval: effectiveAbsenceType === 'recurring' ? recurrenceInterval : 1,
            reason: cleanedReason || null,
        }

        try {
            const success = await saveAbsence(payload, editingAbsenceId, selectedCoachId)
            if (success) {
                setIsModalOpen(false)
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-10">
            {/* ── Hinweis bei fehlender Supabase-Migration ── */}
            {tableMissingWarning && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6 shadow-sm">
                    <div className="flex items-start gap-3">
                        <WarningIcon className="text-amber-600 shrink-0 mt-0.5" size={24} />
                        <div className="text-sm text-amber-900">
                            <p className="font-bold">Hinweis zur Datenbank:</p>
                            <p className="mt-1">
                                Die Tabelle <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">coach_absences</code> wurde in Supabase noch nicht erstellt.
                                Einträge werden aktuell lokal im Browser zwischengespeichert.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Navigation, Trainer-Cookie & Modus-Umschalter ── */}
            <CalendarHeader
                hideHeader={hideHeader}
                onBack={onBack}
                onNewAbsence={() => openNewModal()}
                activeCoachId={activeCoachId}
                setActiveCoach={setActiveCoach}
                coaches={coaches}
                filterCoachId={filterCoachId}
                setFilterCoachId={setFilterCoachId}
                prevMonth={prevMonth}
                nextMonth={nextMonth}
                goToToday={goToToday}
                onSelectMonthYear={setMonthYear}
                currentDate={currentDate}
                viewMode={viewMode}
                setViewMode={setViewMode}
                filteredCount={filteredAbsences.length}
            />

            {/* ── Hauptbereich je nach Ansichtsmodus ── */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-md p-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                    <SpinnerIcon size={28} className="text-blue-600" />
                    <p className="text-sm font-medium">Lade Kalenderdaten...</p>
                </div>
            ) : viewMode === 'month' ? (
                <CalendarMonthView
                    currentDate={currentDate}
                    filteredAbsences={filteredAbsences}
                    trainings={trainings}
                    activeCoachId={activeCoachId}
                    onSelectDate={openNewModal}
                    onEditAbsence={openEditModal}
                />
            ) : viewMode === 'week' ? (
                <CalendarWeekView
                    currentDate={currentDate}
                    filteredAbsences={filteredAbsences}
                    trainings={trainings}
                    activeCoachId={activeCoachId}
                    onSelectDate={openNewModal}
                    onEditAbsence={openEditModal}
                />
            ) : (
                <CalendarListView
                    filteredAbsences={filteredAbsences}
                    onEditAbsence={openEditModal}
                    onDeleteAbsence={deleteAbsence}
                />
            )}

            {/* ── MODAL: Abwesenheit eintragen / bearbeiten ── */}
            <CoachAbsenceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingAbsenceId={editingAbsenceId}
                absenceMode={absenceMode}
                setAbsenceMode={setAbsenceMode}
                selectedCoachId={selectedCoachId}
                setSelectedCoachId={setSelectedCoachId}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                recurringDays={recurringDays}
                toggleRecurringDay={toggleRecurringDay}
                recurrenceInterval={recurrenceInterval}
                setRecurrenceInterval={setRecurrenceInterval}
                selectedReasonChip={selectedReasonChip}
                setSelectedReasonChip={setSelectedReasonChip}
                customDetail={customDetail}
                setCustomDetail={setCustomDetail}
                saving={saving}
                onSave={handleSave}
                coaches={coaches}
            />
        </div>
    )
}
