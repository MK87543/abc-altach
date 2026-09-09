import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach, CoachAbsence, AbsenceType, Training } from '../types/interfaces'
import { useActiveCoach } from '../hooks/useActiveCoach'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { useUrlQueryParam, getUrlParam, updateUrlParams } from '../lib/urlUtils'
import {
    CalendarIcon,
    PlusIcon,
    RepeatIcon,
    UmbrellaIcon,
    TrashIcon,
    EditIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserIcon,
    CheckIcon,
    XIcon,
    WarningIcon,
    SpinnerIcon
} from '../components/Icons'
import {
    GERMAN_WEEKDAYS,
    GERMAN_WEEKDAYS_SHORT,
    GERMAN_MONTHS,
    isCoachAbsentOnDate,
    formatDateGerman,
    formatDateShortGerman,
    getAbsenceTypeBadge,
    getDayOfWeekFromDateString,
    getAbsenceIcon,
    cleanReasonText,
    getAbsenceTheme,
    formatRecurringSummary
} from '../lib/absenceUtils'

interface CoachCalendarProps {
    onBack?: () => void
}

type CalendarViewMode = 'month' | 'week' | 'list'

const REASON_TILES = [
    { label: 'Urlaub', icon: '🏖️', value: 'Urlaub' },
    { label: 'Krank', icon: '🩹', value: 'Krank' },
    { label: 'Beruflich', icon: '💼', value: 'Beruflich' },
    { label: 'Schule / Uni', icon: '🎓', value: 'Schule / Uni' },
    { label: 'Privat', icon: '🏠', value: 'Privat' },
    { label: 'Termin', icon: '🗓️', value: 'Termin' },
]

export default function CoachCalendar({ onBack }: CoachCalendarProps) {
    const { activeCoachId, setActiveCoach } = useActiveCoach()
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

    // Modal-Zustand für neue / bearbeitete Abwesenheit (Progressive Disclosure)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null)
    const [selectedCoachId, setSelectedCoachId] = useState<string>('')
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>('')
    const [hasEndDate, setHasEndDate] = useState<boolean>(false)
    const [isRecurring, setIsRecurring] = useState<boolean>(false)
    const [recurringDays, setRecurringDays] = useState<number[]>([2]) // Wochentage (Mehrfachauswahl)
    const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1) // 1 = jede Woche, 2 = alle 2 Wochen
    const [reason, setReason] = useState<string>('Urlaub')
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
                // Prüfen, ob Tabelle coach_absences noch nicht in Supabase angelegt wurde
                if (
                    error.code === '42P01' ||
                    error.code === 'PGRST205' ||
                    error.message?.includes('coach_absences') ||
                    error.message?.includes('schema cache')
                ) {
                    setTableMissingWarning(true)
                    // Fallback auf lokales Speichern im Browser
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

    // Modal öffnen für Neuanlage
    function openNewModal(presetDate?: string) {
        setEditingAbsenceId(null)
        // Vorauswahl: Wenn ein aktiver Trainer im Cookie hinterlegt ist, nehmen wir diesen
        setSelectedCoachId(activeCoachId || (coaches.length > 0 ? coaches[0].id : ''))
        setIsRecurring(false)
        setHasEndDate(false)
        const initialDate = presetDate || new Date().toISOString().split('T')[0]
        setStartDate(initialDate)
        setEndDate('')
        const presetDay = getDayOfWeekFromDateString(initialDate)
        setRecurringDays([presetDay])
        setRecurrenceInterval(1)
        setReason('Urlaub')
        setIsModalOpen(true)
    }

    // Modal öffnen zum Bearbeiten
    function openEditModal(absence: CoachAbsence) {
        setEditingAbsenceId(absence.id)
        setSelectedCoachId(absence.coach_id)
        const isRec = absence.absence_type === 'recurring'
        setIsRecurring(isRec)
        setHasEndDate(Boolean(absence.end_date && (isRec || absence.end_date !== absence.start_date)))
        setStartDate(absence.start_date)
        setEndDate(absence.end_date || '')
        const days = (absence.recurring_days && absence.recurring_days.length > 0)
            ? absence.recurring_days
            : (absence.recurring_day_of_week !== null && absence.recurring_day_of_week !== undefined ? [absence.recurring_day_of_week] : [2])
        setRecurringDays(days)
        setRecurrenceInterval(absence.recurrence_interval || 1)
        setReason(cleanReasonText(absence.reason) || 'Urlaub')
        setIsModalOpen(true)
    }

    function saveLocally(payload: Partial<CoachAbsence>) {
        const existing = [...absences]
        if (editingAbsenceId) {
            const idx = existing.findIndex(a => a.id === editingAbsenceId)
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

    async function handleSaveAbsence() {
        if (!selectedCoachId) {
            toast.warning('Bitte wähle einen Trainer aus.')
            return
        }
        if (!startDate) {
            toast.warning('Bitte wähle ein Datum aus.')
            return
        }

        const effectiveAbsenceType: AbsenceType = isRecurring
            ? 'recurring'
            : (hasEndDate && endDate ? 'range' : 'single')

        if (effectiveAbsenceType === 'range' && endDate && endDate < startDate) {
            toast.warning('Das Enddatum kann nicht vor dem Startdatum liegen.')
            return
        }
        if (effectiveAbsenceType === 'recurring' && recurringDays.length === 0) {
            toast.warning('Bitte wähle mindestens einen Wochentag aus.')
            return
        }

        setSaving(true)

        const cleanedReason = cleanReasonText(reason)
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
            if (tableMissingWarning) {
                saveLocally(payload)
                setIsModalOpen(false)
                toast.success('Abwesenheit lokal gespeichert.')
                return
            }

            if (editingAbsenceId) {
                // Optimistische Aktualisierung für sofortige visuelle Rückmeldung im Kalender
                setAbsences(prev => prev.map(a => a.id === editingAbsenceId ? {
                    ...a,
                    ...payload,
                    coaches: coaches.find(c => c.id === selectedCoachId) || a.coaches
                } as CoachAbsence : a))

                const { error } = await supabase
                    .from('coach_absences')
                    .update(payload)
                    .eq('id', editingAbsenceId)

                if (error) {
                    if (
                        error.code === '42P01' ||
                        error.code === 'PGRST205' ||
                        error.message?.includes('coach_absences') ||
                        error.message?.includes('schema cache')
                    ) {
                        setTableMissingWarning(true)
                        saveLocally(payload)
                        setIsModalOpen(false)
                        toast.success('Abwesenheit lokal gespeichert.')
                        return
                    }
                    console.error('Fehler beim Aktualisieren:', error)
                    toast.error('Fehler beim Speichern: ' + error.message)
                    await loadAbsences()
                } else {
                    await loadAbsences()
                    setIsModalOpen(false)
                    toast.success('Abwesenheit erfolgreich aktualisiert.')
                }
            } else {
                const { error } = await supabase
                    .from('coach_absences')
                    .insert([payload])

                if (error) {
                    if (
                        error.code === '42P01' ||
                        error.code === 'PGRST205' ||
                        error.message?.includes('coach_absences') ||
                        error.message?.includes('schema cache')
                    ) {
                        setTableMissingWarning(true)
                        saveLocally(payload)
                        setIsModalOpen(false)
                        toast.success('Abwesenheit lokal gespeichert.')
                        return
                    }
                    console.error('Fehler beim Einfügen:', error)
                    toast.error('Fehler beim Speichern: ' + error.message)
                } else {
                    await loadAbsences()
                    setIsModalOpen(false)
                    toast.success('Abwesenheit erfolgreich eingetragen.')
                }
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteAbsence(id: string) {
        const confirmed = await confirm({
            title: 'Abwesenheit löschen',
            message: 'Möchtest du diese Abwesenheit wirklich löschen?',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) return

        if (tableMissingWarning) {
            const updated = absences.filter(a => a.id !== id)
            setAbsences(updated)
            localStorage.setItem('abc_coach_absences_local', JSON.stringify(updated))
            toast.success('Abwesenheit gelöscht.')
            return
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
                return
            }
            console.error('Fehler beim Löschen:', error)
            toast.error('Fehler beim Löschen: ' + error.message)
        } else {
            await loadAbsences()
            toast.success('Abwesenheit gelöscht.')
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


    // Gefilterte Abwesenheiten nach Trainer
    const filteredAbsences = absences.filter(a => {
        if (filterCoachId === 'all') return true
        return a.coach_id === filterCoachId
    })

    // Kalendertage für den aktuellen Monat berechnen (Europäischer Kalender Mo-So)
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()

    // 0 = Sonntag, 1 = Montag ... wir wollen Montag als Tag 0
    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6 // Sonntag wird 6

    const todayStr = new Date().toISOString().split('T')[0]

    // Kalenderzellen aufbauen (inkl. leerer Zellen für Ausrichtung)
    const calendarCells: (string | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarCells.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0')
        const mStr = String(month + 1).padStart(2, '0')
        calendarCells.push(`${year}-${mStr}-${dStr}`)
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* ── Hinweis bei noch nicht ausgeführter Migration ── */}
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
                            <p className="mt-2 text-xs text-amber-800">
                                👉 Führe die Datei <code className="font-mono bg-amber-100 px-1 rounded">SUPABASE_MIGRATION_RLS_AND_CALENDAR.sql</code> im Supabase SQL-Editor aus, um die Speicherung in Supabase zu aktivieren.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Kopfbereich & Trainer-Cookie-Schnellwahl ── */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md p-5 mb-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                <CalendarIcon size={24} />
                            </span>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Trainer-Abwesenheitskalender</h1>
                                <p className="text-sm text-gray-500">Urlaub, Ausfälle & wöchentlich wiederkehrende Verhinderungen</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="px-3.5 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
                            >
                                Zurück
                            </button>
                        )}
                        <button
                            onClick={() => openNewModal()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
                        >
                            <PlusIcon size={18} />
                            <span>Abwesenheit eintragen</span>
                        </button>
                    </div>
                </div>

                {/* Trainer-Identität ("Wer bist du?" - Cookie-Speicherung) */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 bg-blue-50/70 border border-blue-200/80 px-3.5 py-2 rounded-lg text-blue-900 w-full sm:w-auto">
                        <UserIcon size={18} className="text-blue-600" />
                        <span className="font-medium text-xs sm:text-sm">Aktiver Trainer:</span>
                        <select
                            value={activeCoachId || ''}
                            onChange={(e) => setActiveCoach(e.target.value || null)}
                            className="bg-white border border-blue-300 text-blue-900 text-xs sm:text-sm rounded-md px-2.5 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">(Nicht ausgewählt)</option>
                            {coaches.map(coach => (
                                <option key={coach.id} value={coach.id}>
                                    {coach.name} {coach.role ? `(${coach.role})` : ''}
                                </option>
                            ))}
                        </select>
                        <span className="text-[11px] text-blue-500 hidden md:inline">
                            (im Cookie gespeichert)
                        </span>
                    </div>

                    {/* Trainer-Filter für Kalenderansicht */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <span className="text-gray-500 text-xs">Filter:</span>
                        <select
                            value={filterCoachId}
                            onChange={(e) => setFilterCoachId(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-700 text-xs sm:text-sm rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Alle Trainer anzeigen</option>
                            {coaches.map(coach => (
                                <option key={coach.id} value={coach.id}>
                                    Nur {coach.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Ansichtsumschalter (Monat / Woche / Liste) ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                {/* Monats-Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition"
                        title="Vorheriger Monat"
                    >
                        <ChevronLeftIcon size={18} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition"
                        title="Nächster Monat"
                    >
                        <ChevronRightIcon size={18} />
                    </button>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-lg text-gray-700 transition"
                    >
                        Heute
                    </button>
                    <span className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-lg text-gray-700 transition">
                        {GERMAN_MONTHS[month]} {year}
                    </span>
                </div>

                {/* Ansichtsmodus Tabs */}
                <div className="flex p-1 bg-gray-200/80 rounded-lg text-xs font-medium self-stretch sm:self-auto">
                    <button
                        onClick={() => setViewMode('month')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Monat
                    </button>
                    <button
                        onClick={() => setViewMode('week')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Woche
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Listenansicht ({filteredAbsences.length})
                    </button>
                </div>
            </div>

            {/* ── Hauptbereich je nach Ansichtsmodus ── */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-md p-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                    <SpinnerIcon size={28} className="text-blue-600" />
                    <p className="text-sm font-medium">Lade Kalenderdaten...</p>
                </div>
            ) : viewMode === 'month' ? (
                /* ── MONATSANSICHT ── */
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    {/* Wochentagsköpfe (Mo - So) */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-center text-xs font-bold text-gray-600">
                        {GERMAN_WEEKDAYS_SHORT.slice(1).concat(GERMAN_WEEKDAYS_SHORT[0]).map((wd, i) => (
                            <div key={wd} className={`py-2.5 ${i >= 5 ? 'text-amber-700 bg-amber-50/50' : ''}`}>
                                {wd}
                            </div>
                        ))}
                    </div>

                    {/* Kalenderraster */}
                    <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-100">
                        {calendarCells.map((dateStr, index) => {
                            if (!dateStr) {
                                return (
                                    <div key={`empty-${index}`} className="min-h-[105px] md:min-h-[120px] bg-gray-50/40" />
                                )
                            }

                            const isToday = dateStr === todayStr
                            const cellDayNumber = parseInt(dateStr.split('-')[2], 10)
                            const dayOfWeek = getDayOfWeekFromDateString(dateStr)
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                            // Abwesenheiten an diesem Tag
                            const dayAbsences = filteredAbsences.filter(a => isCoachAbsentOnDate(a, dateStr))

                            // Trainings an diesem Tag
                            const dayTrainings = trainings.filter(t => t.date === dateStr)

                            return (
                                <div
                                    key={dateStr}
                                    onClick={() => openNewModal(dateStr)}
                                    className={`min-h-[105px] md:min-h-[120px] p-1.5 flex flex-col justify-between transition group cursor-pointer hover:bg-blue-50/40 ${isToday ? 'bg-blue-50/70 ring-2 ring-blue-500 ring-inset' : isWeekend ? 'bg-amber-50/20' : 'bg-white'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                                            {cellDayNumber}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openNewModal(dateStr)
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 p-0.5 rounded transition"
                                            title="Abwesenheit für diesen Tag hinzufügen"
                                        >
                                            <PlusIcon size={14} />
                                        </button>
                                    </div>

                                    {/* Einträge an diesem Tag */}
                                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                                        {/* Geplante Trainings */}
                                        {dayTrainings.map(t => (
                                            <div
                                                key={t.id}
                                                className="text-[10px] md:text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1"
                                                title={`Training: ${t.description || 'Geplant'}`}
                                            >
                                                <span>🏸</span>
                                                <span className="truncate">{t.description || 'Training'}</span>
                                            </div>
                                        ))}

                                        {/* Abwesende Trainer */}
                                        {dayAbsences.map(a => {
                                            const coachName = a.coaches?.name || 'Trainer'
                                            const isOwn = a.coach_id === activeCoachId
                                            const theme = getAbsenceTheme(a)
                                            const cleanReason = cleanReasonText(a.reason)

                                            return (
                                                <div
                                                    key={a.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditModal(a)
                                                    }}
                                                    className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded font-medium truncate flex items-center justify-between gap-1 shadow-2xs border cursor-pointer hover:opacity-90 transition ${theme.bgClass} ${theme.textClass} ${theme.borderClass} ${isOwn ? 'ring-2 ring-blue-500 font-bold' : ''}`}
                                                    title={`${coachName} abwesend${cleanReason ? `: ${cleanReason}` : ''} (${theme.icon}) - Klicke zum Bearbeiten`}
                                                >
                                                    <div className="flex items-center gap-1 truncate">
                                                        <span>{theme.icon}</span>
                                                        <span className="truncate">{coachName}</span>
                                                    </div>
                                                    {isOwn && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" title="Dein Eintrag" />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : viewMode === 'week' ? (
                /* ── WOCHENANSICHT (7 Tage ab aktuellem Tag) ── */
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        {Array.from({ length: 7 }).map((_, idx) => {
                            const d = new Date(currentDate)
                            d.setDate(currentDate.getDate() + idx)
                            const dateKey = d.toISOString().split('T')[0]
                            const dayName = GERMAN_WEEKDAYS[d.getDay()]
                            const dayAbs = filteredAbsences.filter(a => isCoachAbsentOnDate(a, dateKey))
                            const dayTrain = trainings.filter(t => t.date === dateKey)
                            const isToday = dateKey === todayStr

                            return (
                                <div
                                    key={dateKey}
                                    className={`rounded-xl border p-3 min-h-[160px] flex flex-col justify-between ${isToday ? 'bg-blue-50/60 border-blue-400' : 'bg-gray-50/60 border-gray-200'}`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase">{dayName}</p>
                                                <p className="text-sm font-bold text-black">{formatDateShortGerman(dateKey)}</p>
                                            </div>
                                            {isToday && (
                                                <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                                                    Heute
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            {dayTrain.map(t => (
                                                <div key={t.id} className="text-xs bg-green-100 text-green-800 p-1.5 rounded-md font-medium">
                                                    🏸 {t.description || 'Training geplant'}
                                                </div>
                                            ))}

                                            {dayAbs.map(a => {
                                                const coachName = a.coaches?.name || 'Trainer'
                                                const isOwn = a.coach_id === activeCoachId
                                                const theme = getAbsenceTheme(a)
                                                const cleanReason = cleanReasonText(a.reason)

                                                return (
                                                    <div
                                                        key={a.id}
                                                        onClick={() => openEditModal(a)}
                                                        className={`text-xs p-1.5 rounded-md cursor-pointer hover:opacity-90 transition border shadow-2xs ${theme.bgClass} ${theme.textClass} ${theme.borderClass} ${isOwn ? 'ring-2 ring-blue-500 font-bold' : ''}`}
                                                    >
                                                        <p className="font-bold flex items-center justify-between gap-1">
                                                            <span className="flex items-center gap-1 truncate">
                                                                <span>{theme.icon}</span>
                                                                <span className="truncate">{coachName}</span>
                                                            </span>
                                                            {isOwn && (
                                                                <span className="text-[9px] bg-blue-600 text-white px-1 rounded-full flex-shrink-0">Du</span>
                                                            )}
                                                        </p>
                                                        {cleanReason && <p className="text-[11px] opacity-85 truncate mt-0.5">{cleanReason}</p>}
                                                    </div>
                                                )
                                            })}

                                            {dayAbs.length === 0 && dayTrain.length === 0 && (
                                                <p className="text-xs text-gray-400 italic py-2 text-center">Keine Einträge</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => openNewModal(dateKey)}
                                        className="mt-3 w-full py-1 text-xs text-blue-600 hover:bg-blue-100/50 rounded transition font-medium flex items-center justify-center gap-1"
                                    >
                                        <PlusIcon size={14} /> Eintragen
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                /* ── LISTENANSICHT ── */
                <div className="space-y-6">
                    {/* 1. Wiederkehrende Verhinderungen (z. B. jeden Dienstag) */}
                    <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                                <RepeatIcon size={20} />
                            </span>
                            <h2 className="text-lg font-bold text-gray-800">
                                Regelmäßig wiederkehrende Verhinderungen
                            </h2>
                        </div>

                        {filteredAbsences.filter(a => a.absence_type === 'recurring').length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">
                                Keine wiederkehrenden Abwesenheiten eingetragen.
                            </p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredAbsences
                                    .filter(a => a.absence_type === 'recurring')
                                    .map(a => {
                                        const coachName = a.coaches?.name || 'Trainer'
                                        const theme = getAbsenceTheme(a)
                                        const cleanReason = cleanReasonText(a.reason)
                                        const recurringSummary = formatRecurringSummary(
                                            a.recurring_days,
                                            a.recurrence_interval,
                                            a.recurring_day_of_week
                                        )

                                        return (
                                            <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{theme.icon}</span>
                                                        <span className="font-bold text-gray-800">{coachName}</span>
                                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                                            {recurringSummary}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Gültig ab: {formatDateGerman(a.start_date)}
                                                        {a.end_date ? ` bis ${formatDateGerman(a.end_date)}` : ' (Dauerhaft)'}
                                                        {cleanReason ? ` • Grund: ${cleanReason}` : ''}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openEditModal(a)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                                        title="Bearbeiten"
                                                    >
                                                        <EditIcon size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAbsence(a.id)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                                        title="Löschen"
                                                    >
                                                        <TrashIcon size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </div>

                    {/* 2. Geplante Urlaube & Einzeltage */}
                    <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                                <UmbrellaIcon size={20} />
                            </span>
                            <h2 className="text-lg font-bold text-gray-800">
                                Urlaub & Einzeltag-Abwesenheiten
                            </h2>
                        </div>

                        {filteredAbsences.filter(a => a.absence_type !== 'recurring').length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">
                                Keine Urlaube oder Einzeltage eingetragen.
                            </p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredAbsences
                                    .filter(a => a.absence_type !== 'recurring')
                                    .sort((a, b) => a.start_date.localeCompare(b.start_date))
                                    .map(a => {
                                        const coachName = a.coaches?.name || 'Trainer'
                                        const theme = getAbsenceTheme(a)
                                        const cleanReason = cleanReasonText(a.reason)
                                        const badge = getAbsenceTypeBadge(a)
                                        const isPast = (a.end_date || a.start_date) < todayStr

                                        return (
                                            <div key={a.id} className={`py-3 flex items-center justify-between gap-4 ${isPast ? 'opacity-60' : ''}`}>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{theme.icon}</span>
                                                        <span className="font-bold text-gray-800">{coachName}</span>
                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${badge.color}`}>
                                                            {badge.label}
                                                        </span>
                                                        {isPast && (
                                                            <span className="text-[11px] text-gray-400">(Vergangen)</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-600 mt-0.5 font-medium">
                                                        {a.absence_type === 'range' ? (
                                                            <>Zeitraum: {formatDateGerman(a.start_date)} bis {a.end_date ? formatDateGerman(a.end_date) : 'offen'}</>
                                                        ) : (
                                                            <>Datum: {formatDateGerman(a.start_date)}</>
                                                        )}
                                                        {cleanReason ? ` • Grund: ${cleanReason}` : ''}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openEditModal(a)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                        title="Bearbeiten"
                                                    >
                                                        <EditIcon size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAbsence(a.id)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                        title="Löschen"
                                                    >
                                                        <TrashIcon size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL: Abwesenheit eintragen / bearbeiten ── */}
            {isModalOpen && (() => {
                const effectiveAbsenceType: AbsenceType = isRecurring
                    ? 'recurring'
                    : (hasEndDate && endDate ? 'range' : 'single')
                const activeModalIcon = getAbsenceIcon({ absence_type: effectiveAbsenceType, reason })
                const previewTheme = getAbsenceTheme({ absence_type: effectiveAbsenceType, reason })
                const coachObj = coaches.find(c => c.id === selectedCoachId)

                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-150">
                            {/* Modal Header */}
                            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl leading-none p-1.5 bg-white/10 rounded-xl">{activeModalIcon}</span>
                                    <div>
                                        <h3 className="text-base font-bold text-white leading-tight">
                                            {editingAbsenceId ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            {coachObj ? coachObj.name : 'Trainer auswählen'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                                    title="Schließen"
                                >
                                    <XIcon size={20} />
                                </button>
                            </div>

                            {/* Modal Body (Scrollable with whitespace grouping) */}
                            <div className="p-6 space-y-6 overflow-y-auto flex-1">
                                {/* 1. Sektion: Trainer auswählen */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Trainer *
                                    </label>
                                    <select
                                        value={selectedCoachId}
                                        onChange={(e) => setSelectedCoachId(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition cursor-pointer"
                                    >
                                        <option value="" disabled>-- Trainer auswählen --</option>
                                        {coaches.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.role ? `(${c.role})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 2. Sektion: Zeitraum (Progressive Disclosure) */}
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Zeitraum
                                    </label>

                                    {!isRecurring ? (
                                        !hasEndDate ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-medium text-slate-600">Datum *</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasEndDate(true)
                                                            if (!endDate) setEndDate(startDate)
                                                        }}
                                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                                                    >
                                                        <PlusIcon size={14} />
                                                        <span>+ Enddatum (Mehrtägig)</span>
                                                    </button>
                                                </div>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-medium text-slate-600">Mehrtägiger Zeitraum *</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasEndDate(false)
                                                            setEndDate('')
                                                        }}
                                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
                                                    >
                                                        <XIcon size={13} />
                                                        <span>Nur Einzeltag</span>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-1">Von</span>
                                                        <input
                                                            type="date"
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-1">Bis</span>
                                                        <input
                                                            type="date"
                                                            value={endDate}
                                                            min={startDate}
                                                            onChange={(e) => setEndDate(e.target.value)}
                                                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="block text-xs font-medium text-slate-600 mb-1">Gültig ab *</span>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                                />
                                            </div>
                                            <div>
                                                <span className="block text-xs font-medium text-slate-600 mb-1">Gültig bis (optional)</span>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    min={startDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    placeholder="Unbefristet"
                                                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Toggle Switch: Wiederkehrende Abwesenheit (Progressive Disclosure) */}
                                    <div className="flex items-center justify-between pt-1">
                                        <div>
                                            <span className="block text-sm font-semibold text-slate-800">
                                                Wiederkehrende Abwesenheit
                                            </span>
                                            <span className="block text-xs text-slate-500">
                                                Regelmäßig an bestimmten Wochentagen
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isRecurring}
                                            onClick={() => setIsRecurring(prev => !prev)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${isRecurring ? 'bg-blue-600' : 'bg-slate-200'
                                                }`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isRecurring ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Eingeblendeter Wiederholungs-Block (Fließend via Progressive Disclosure) */}
                                    {isRecurring && (
                                        <div className="p-4 bg-slate-50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {/* Wiederholungs-Takt */}
                                            <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-2xs">
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-800">
                                                        Wiederholungs-Takt
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {recurrenceInterval === 1 ? 'Jede Woche (1x wöchentlich)' : `Alle ${recurrenceInterval} Wochen`}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRecurrenceInterval(prev => Math.max(1, prev - 1))}
                                                        disabled={recurrenceInterval <= 1}
                                                        className="w-7 h-7 rounded-lg bg-white text-slate-800 font-bold text-sm flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                                                        title="Takt verringern"
                                                    >
                                                        −
                                                    </button>

                                                    <div className="flex items-center gap-1 px-1.5">
                                                        <span className="text-xs text-slate-500 font-medium">Alle</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="52"
                                                            value={recurrenceInterval}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10)
                                                                if (!isNaN(val) && val >= 1) {
                                                                    setRecurrenceInterval(Math.min(52, val))
                                                                } else if (e.target.value === '') {
                                                                    setRecurrenceInterval(1)
                                                                }
                                                            }}
                                                            className="w-7 text-center font-bold text-xs text-slate-900 bg-white rounded py-0.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                        />
                                                        <span className="text-xs text-slate-700 font-medium">
                                                            {recurrenceInterval === 1 ? 'Woche' : 'Wochen'}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setRecurrenceInterval(prev => Math.min(52, prev + 1))}
                                                        className="w-7 h-7 rounded-lg bg-white text-slate-800 font-bold text-sm flex items-center justify-center hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                                                        title="Takt erhöhen"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Wochentage */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-800">
                                                        Wochentage
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {recurringDays.length} {recurringDays.length === 1 ? 'Tag' : 'Tage'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1.5">
                                                    {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                                        const isSelected = recurringDays.includes(dayIdx)
                                                        return (
                                                            <button
                                                                key={dayIdx}
                                                                type="button"
                                                                onClick={() => toggleRecurringDay(dayIdx)}
                                                                className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${isSelected
                                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                                    : 'bg-white text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                                title={GERMAN_WEEKDAYS[dayIdx]}
                                                            >
                                                                <span>{GERMAN_WEEKDAYS_SHORT[dayIdx]}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    Rhythmus: <strong className="font-semibold text-slate-800">{formatRecurringSummary(recurringDays, recurrenceInterval)}</strong>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Sektion: Grund der Abwesenheit (Touch-optimiertes Grid) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        Grund der Abwesenheit *
                                    </label>

                                    {/* 2- oder 3-spaltiges Touch-Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                        {REASON_TILES.map(tile => {
                                            const isSelected = reason === tile.value || (!reason && tile.value === 'Urlaub')
                                            return (
                                                <button
                                                    key={tile.value}
                                                    type="button"
                                                    onClick={() => setReason(tile.value)}
                                                    className={`p-3 rounded-xl text-left transition flex items-center gap-2.5 cursor-pointer ${isSelected
                                                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium'
                                                        }`}
                                                >
                                                    <span className="text-xl shrink-0">{tile.icon}</span>
                                                    <span className="text-sm truncate">{tile.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Optionale Notiz / Freitext */}
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Optionale Notiz / Details (z. B. Trainingslager, Prüfung)..."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                    />
                                </div>

                                {/* 4. Sektion: Live-Vorschau (Subtil & Flat) */}
                                <div className="p-3.5 bg-slate-50 rounded-xl flex items-center justify-between gap-3">
                                    <span className="text-xs font-medium text-slate-500">Vorschau im Kalender:</span>
                                    <div className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-2 ${previewTheme.bgClass} ${previewTheme.textClass}`}>
                                        <span className="text-base">{previewTheme.icon}</span>
                                        <span>{coachObj?.name || 'Trainer'}</span>
                                        {reason.trim() && (
                                            <span className="opacity-80 font-normal truncate max-w-[150px]">
                                                ({cleanReasonText(reason)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Footer (Am unteren Rand fixiert) */}
                            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100 shrink-0 z-10">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveAbsence}
                                    disabled={saving}
                                    className="px-6 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs hover:shadow transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {saving ? (
                                        <>
                                            <SpinnerIcon size={16} />
                                            <span>Speichert...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckIcon size={16} />
                                            <span>{editingAbsenceId ? 'Änderungen speichern' : 'Abwesenheit speichern'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
