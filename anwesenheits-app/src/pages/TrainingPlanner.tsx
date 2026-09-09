import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach, CoachAbsence, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { useUrlQueryParam } from '../lib/urlUtils'
import {
    CalendarIcon,
    PlusIcon,
    ClipboardIcon,
    CheckIcon,
    XIcon,
    EditIcon,
    TrashIcon,
    CircleIcon,
    UserIcon,
    UmbrellaIcon,
    SpinnerIcon
} from '../components/Icons'
import { getCoachAbsenceMapForDate, formatAbsenceGerman } from '../lib/absenceUtils'
import SeasonPlanner from '../components/training/SeasonPlanner'

interface TrainingPlannerProps {
    onBack?: () => void
    onOpenCalendar?: () => void
}

interface TrainingWithCoaches extends Training {
    coach_attendance?: {
        coach_id: string
        is_mandatory: boolean
        coaches: { name: string }
    }[]
}

export default function TrainingPlanner({ onBack, onOpenCalendar }: TrainingPlannerProps) {
    const { toast } = useToast()
    const { confirm } = useConfirm()

    // ── 2 Reiter: Einzeltraining vs. Saison-Planung ──
    const [planTab, setPlanTab] = useUrlQueryParam<'single' | 'season'>('plannerTab', 'single')

    const [trainings, setTrainings] = useState<TrainingWithCoaches[]>([])
    const [coaches, setCoaches] = useState<Coach[]>([])
    const [absences, setAbsences] = useState<CoachAbsence[]>([])
    const [loadingData, setLoadingData] = useState(true)

    // Formular-State für Einzeltraining (wie davor)
    const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0])
    const [newDescription, setNewDescription] = useState('')
    const [selectedMandatoryCoachIds, setSelectedMandatoryCoachIds] = useState<string[]>([])
    const [selectedAdditionalCoachIds, setSelectedAdditionalCoachIds] = useState<string[]>([])
    const [creatingTraining, setCreatingTraining] = useState(false)

    // Inline-Bearbeitung für bestehende Trainings
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDescription, setEditDescription] = useState('')
    const [editMandatoryCoachIds, setEditMandatoryCoachIds] = useState<string[]>([])
    const [editAdditionalCoachIds, setEditAdditionalCoachIds] = useState<string[]>([])
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Set aller bereits geplanten Datums-Strings
    const existingDates = useMemo(() => {
        return new Set(trainings.map(t => t.date))
    }, [trainings])

    async function loadCoaches() {
        const { data } = await supabase
            .from('coaches')
            .select('*')
            .eq('active', true)
            .order('name')

        if (data) setCoaches(data)
    }

    async function loadAbsences() {
        try {
            const { data, error } = await supabase
                .from('coach_absences')
                .select('*')

            if (!error && data) {
                setAbsences(data as CoachAbsence[])
            } else {
                const cached = localStorage.getItem('abc_coach_absences_local')
                if (cached) {
                    try {
                        setAbsences(JSON.parse(cached))
                    } catch {
                        // ignore
                    }
                }
            }
        } catch {
            const cached = localStorage.getItem('abc_coach_absences_local')
            if (cached) {
                try {
                    setAbsences(JSON.parse(cached))
                } catch {
                    // ignore
                }
            }
        }
    }

    async function loadTrainings() {
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('trainings')
            .select(`
                *,
                coach_attendance (
                    coach_id,
                    is_mandatory,
                    coaches ( name )
                )
            `)
            .gte('date', today)
            .order('date', { ascending: true })

        if (error) {
            console.error('Fehler beim Laden der Trainings:', error)
        } else if (data) {
            setTrainings(data as any)
        }
    }

    async function loadAll() {
        setLoadingData(true)
        await Promise.all([
            loadTrainings(),
            loadCoaches(),
            loadAbsences()
        ])
        setLoadingData(false)
    }

    useEffect(() => {
        loadAll()
    }, [])

    // Abwesenheiten am gewählten Einzeldatum
    const absenceMapForNewDate = getCoachAbsenceMapForDate(absences, newDate)

    async function toggleMandatoryCoach(coachId: string) {
        const isSelecting = !selectedMandatoryCoachIds.includes(coachId)
        if (isSelecting && absenceMapForNewDate.has(coachId)) {
            const absence = absenceMapForNewDate.get(coachId)!
            const coach = coaches.find(c => c.id === coachId)
            const confirmed = await confirm({
                title: 'Trainer abwesend',
                message: `Hinweis: ${coach?.name || 'Dieser Trainer'} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(absence)}).\n\nTrotzdem als Pflichttrainer einteilen?`,
                confirmText: 'Trotzdem einteilen',
                cancelText: 'Abbrechen',
                isDanger: false,
            })
            if (!confirmed) return
        }

        setSelectedMandatoryCoachIds(prev => {
            if (prev.includes(coachId)) return prev.filter(id => id !== coachId)
            if (prev.length >= 2) return prev // Max 2
            return [...prev, coachId]
        })
    }

    async function toggleAdditionalCoach(coachId: string) {
        const isSelecting = !selectedAdditionalCoachIds.includes(coachId)
        if (isSelecting && absenceMapForNewDate.has(coachId)) {
            const absence = absenceMapForNewDate.get(coachId)!
            const coach = coaches.find(c => c.id === coachId)
            const confirmed = await confirm({
                title: 'Trainer abwesend',
                message: `Hinweis: ${coach?.name || 'Dieser Trainer'} ist an diesem Tag als abwesend eingetragen (${formatAbsenceGerman(absence)}).\n\nTrotzdem als Zusatztrainer einteilen?`,
                confirmText: 'Trotzdem einteilen',
                cancelText: 'Abbrechen',
                isDanger: false,
            })
            if (!confirmed) return
        }

        setSelectedAdditionalCoachIds(prev =>
            prev.includes(coachId)
                ? prev.filter(id => id !== coachId)
                : [...prev, coachId]
        )
    }

    // ── Einzeltraining erstellen ──
    async function createSingleTraining() {
        if (!newDate) {
            toast.warning('Bitte wähle ein Datum aus.')
            return
        }

        setCreatingTraining(true)
        try {
            // 1. Training erstellen
            const { data: trainingData, error: trainingError } = await supabase
                .from('trainings')
                .insert({
                    date: newDate,
                    description: newDescription.trim() || null
                })
                .select()
                .single()

            if (trainingError) {
                toast.error('Fehler beim Erstellen: ' + trainingError.message)
                return
            }

            // 2. Trainer zuweisen
            const allCoachInserts = [
                ...selectedMandatoryCoachIds.map(coachId => ({
                    training_id: trainingData.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...selectedAdditionalCoachIds.map(coachId => ({
                    training_id: trainingData.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachInserts.length > 0 && trainingData) {
                await supabase.from('coach_attendance').insert(allCoachInserts)
            }

            setNewDescription('')
            setSelectedMandatoryCoachIds([])
            setSelectedAdditionalCoachIds([])
            await loadTrainings()
            toast.success('Training erfolgreich geplant!')
        } catch (err) {
            console.error('Erstellen Fehler:', err)
            toast.error('Unerwarteter Fehler beim Erstellen.')
        } finally {
            setCreatingTraining(false)
        }
    }

    // ── Einzeltraining aktualisieren ──
    async function updateTraining(id: string) {
        try {
            const { error } = await supabase
                .from('trainings')
                .update({ description: editDescription.trim() || null })
                .eq('id', id)

            if (error) {
                toast.error('Fehler beim Aktualisieren: ' + error.message)
                return
            }

            await supabase.from('coach_attendance').delete().eq('training_id', id)

            const allCoachInserts = [
                ...editMandatoryCoachIds.map(coachId => ({
                    training_id: id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                })),
                ...editAdditionalCoachIds.map(coachId => ({
                    training_id: id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: false
                }))
            ]

            if (allCoachInserts.length > 0) {
                await supabase.from('coach_attendance').insert(allCoachInserts)
            }

            setEditingId(null)
            setEditMandatoryCoachIds([])
            setEditAdditionalCoachIds([])
            await loadTrainings()
            toast.success('Training aktualisiert!')
        } catch (err) {
            console.error('Update Fehler:', err)
            toast.error('Fehler beim Aktualisieren.')
        }
    }

    // ── Training löschen ──
    async function deleteTraining(id: string) {
        const confirmed = await confirm({
            title: 'Training löschen',
            message: 'Training wirklich löschen? Alle zugehörigen Anwesenheitsdaten gehen verloren.',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            isDanger: true,
        })
        if (!confirmed) return

        setDeletingId(id)
        try {
            await supabase.from('attendance').delete().eq('training_id', id)
            await supabase.from('coach_attendance').delete().eq('training_id', id)

            const { error } = await supabase
                .from('trainings')
                .delete()
                .eq('id', id)

            if (error) {
                toast.error('Fehler beim Löschen: ' + error.message)
            } else {
                await loadTrainings()
                toast.success('Training gelöscht.')
            }
        } finally {
            setDeletingId(null)
        }
    }

    function formatDateGerman(dateString: string) {
        const date = new Date(dateString + 'T00:00:00')
        const today = new Date().toISOString().split('T')[0]
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        let prefixElement = null
        if (dateString === today) {
            prefixElement = (
                <span className="inline-flex items-center gap-1 mr-2">
                    <CircleIcon className="text-red-600" size={10} />
                    <span className="font-bold text-red-600 text-xs tracking-wider">HEUTE</span>
                </span>
            )
        } else if (dateString === tomorrowStr) {
            prefixElement = (
                <span className="inline-flex items-center gap-1 mr-2">
                    <CircleIcon className="text-amber-500" size={10} />
                    <span className="font-bold text-amber-600 text-xs tracking-wider">MORGEN</span>
                </span>
            )
        }

        const dateStr = date.toLocaleDateString('de-AT', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })

        return { prefix: prefixElement, dateStr }
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <CalendarIcon size={26} className="text-blue-600" />
                        <span>Trainings planen</span>
                    </h1>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {onOpenCalendar && (
                            <button
                                type="button"
                                onClick={onOpenCalendar}
                                className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg transition cursor-pointer"
                                title="Trainer-Abwesenheiten und Urlaub anzeigen"
                            >
                                <UmbrellaIcon size={15} />
                                <span>Trainer-Kalender</span>
                            </button>
                        )}
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg transition text-xs font-semibold cursor-pointer"
                            >
                                Zurück
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 2 REITER (Tabs): Einzeltraining & Saisonplanung ── */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl max-w-md w-full shadow-2xs">
                <button
                    type="button"
                    onClick={() => setPlanTab('single')}
                    className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        planTab === 'single'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <CalendarIcon size={16} />
                    <span>Einzeltraining</span>
                </button>

                <button
                    type="button"
                    onClick={() => setPlanTab('season')}
                    className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        planTab === 'season'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <PlusIcon size={16} />
                    <span>Saison-Planung</span>
                </button>
            </div>

            {/* ── REITER-INHALT ── */}
            {loadingData ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <SpinnerIcon size={28} className="text-blue-600 mb-2" />
                    <span className="text-xs text-slate-500 font-medium">Lade Daten...</span>
                </div>
            ) : planTab === 'season' ? (
                /* ── REITER 2: Saison-Planung ── */
                <SeasonPlanner
                    coaches={coaches}
                    absences={absences}
                    existingDates={existingDates}
                    onTrainingsCreated={async () => {
                        await loadTrainings()
                        setPlanTab('single')
                    }}
                />
            ) : (
                /* ── REITER 1: Einzeltraining (wie davor) ── */
                <div className="space-y-6">
                    {/* Formular: Neues Training planen */}
                    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <PlusIcon size={20} className="text-blue-600" />
                            <span>Einzeltraining planen</span>
                        </h2>

                        <div className="space-y-3.5">
                            {/* Datum */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Datum *
                                </label>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Beschreibung */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Beschreibung (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="z. B. Techniktraining, Taktik, Aufschlag..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Pflichttrainer */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-blue-700">
                                        Pflichttrainer (max. 2)
                                    </span>
                                    <span className={`text-[11px] font-bold px-2 py-0.2 rounded-full ${
                                        selectedMandatoryCoachIds.length >= 2
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {selectedMandatoryCoachIds.length}/2
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {coaches.map(coach => {
                                        const isSelected = selectedMandatoryCoachIds.includes(coach.id)
                                        const isAlreadyAdditional = selectedAdditionalCoachIds.includes(coach.id)
                                        const isDisabled = isAlreadyAdditional || (!isSelected && selectedMandatoryCoachIds.length >= 2)
                                        const coachAbsence = absenceMapForNewDate.get(coach.id)
                                        return (
                                            <button
                                                key={coach.id}
                                                type="button"
                                                onClick={() => !isDisabled && toggleMandatoryCoach(coach.id)}
                                                disabled={isDisabled}
                                                title={coachAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(coachAbsence)})` : undefined}
                                                className={`px-3 py-1.5 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                                    isDisabled
                                                        ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                        : isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <UserIcon size={13} />
                                                <span>{coach.name}</span>
                                                {coachAbsence && (
                                                    <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                                        Abwesend
                                                    </span>
                                                )}
                                                {isSelected && <CheckIcon size={13} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Zusatztrainer */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-emerald-700">
                                        Zusatztrainer (freiwillig)
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {coaches.map(coach => {
                                        const isSelected = selectedAdditionalCoachIds.includes(coach.id)
                                        const isAlreadyMandatory = selectedMandatoryCoachIds.includes(coach.id)
                                        const isDisabled = isAlreadyMandatory
                                        const coachAbsence = absenceMapForNewDate.get(coach.id)
                                        return (
                                            <button
                                                key={coach.id}
                                                type="button"
                                                onClick={() => !isDisabled && toggleAdditionalCoach(coach.id)}
                                                disabled={isDisabled}
                                                title={coachAbsence ? `Achtung: ${coach.name} ist abwesend (${formatAbsenceGerman(coachAbsence)})` : undefined}
                                                className={`px-3 py-1.5 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                                    isDisabled
                                                        ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                        : isSelected
                                                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <UserIcon size={13} />
                                                <span>{coach.name}</span>
                                                {coachAbsence && (
                                                    <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                                        Abwesend
                                                    </span>
                                                )}
                                                {isSelected && <CheckIcon size={13} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Button: Training erstellen */}
                        <button
                            type="button"
                            onClick={createSingleTraining}
                            disabled={creatingTraining || !newDate}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
                        >
                            {creatingTraining ? (
                                <>
                                    <SpinnerIcon size={18} />
                                    <span>Erstelle Training...</span>
                                </>
                            ) : (
                                <>
                                    <CheckIcon size={18} />
                                    <span>Training erstellen</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Liste: Geplante Trainings (wie davor direkt darunter) */}
                    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
                        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ClipboardIcon size={20} className="text-slate-600" />
                            <span>Geplante Trainings ({trainings.length})</span>
                        </h2>

                        {trainings.length === 0 ? (
                            <p className="text-slate-500 text-xs text-center py-6">
                                Noch keine Trainings geplant. Erstelle dein erstes Training oben oder wechsle zur Saison-Planung.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {trainings.map(training => {
                                    const isToday = training.date === new Date().toISOString().split('T')[0]
                                    const isEditing = editingId === training.id
                                    const absenceMap = getCoachAbsenceMapForDate(absences, training.date)
                                    const formatted = formatDateGerman(training.date)

                                    return (
                                        <div
                                            key={training.id}
                                            className={`p-3.5 rounded-xl border transition ${
                                                isToday
                                                    ? 'bg-blue-50/70 border-blue-200'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                                <div className="flex-1 w-full">
                                                    {/* Datum & Heute-Badge */}
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <CalendarIcon size={16} className="text-slate-400" />
                                                        <span className="font-bold text-slate-800 text-sm sm:text-base flex items-center">
                                                            {formatted.prefix}
                                                            {formatted.dateStr}
                                                        </span>
                                                        {isToday && (
                                                            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                                                Heute
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isEditing ? (
                                                        /* Inline-Bearbeitung */
                                                        <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                            <div>
                                                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                                    Beschreibung
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editDescription}
                                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                                    placeholder="Beschreibung (optional)..."
                                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                />
                                                            </div>

                                                            {/* Pflichttrainer */}
                                                            <div>
                                                                <span className="block text-xs font-semibold text-blue-700 mb-1">
                                                                    Pflichttrainer ({editMandatoryCoachIds.length}/2)
                                                                </span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {coaches.map(coach => {
                                                                        const isSelected = editMandatoryCoachIds.includes(coach.id)
                                                                        const isAlreadyAdditional = editAdditionalCoachIds.includes(coach.id)
                                                                        const isDisabled = isAlreadyAdditional || (!isSelected && editMandatoryCoachIds.length >= 2)
                                                                        const editAbsence = absenceMap.get(coach.id)
                                                                        return (
                                                                            <button
                                                                                key={coach.id}
                                                                                type="button"
                                                                                disabled={isDisabled}
                                                                                onClick={() => {
                                                                                    setEditMandatoryCoachIds(prev =>
                                                                                        prev.includes(coach.id)
                                                                                            ? prev.filter(id => id !== coach.id)
                                                                                            : [...prev, coach.id]
                                                                                    )
                                                                                }}
                                                                                className={`px-2 py-1 rounded-md text-xs border transition flex items-center gap-1 cursor-pointer ${
                                                                                    isDisabled
                                                                                        ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                                        : isSelected
                                                                                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                                                                        : 'bg-white border-slate-200 text-slate-700'
                                                                                }`}
                                                                            >
                                                                                <UserIcon size={12} />
                                                                                <span>{coach.name}</span>
                                                                                {editAbsence && <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded">Abwesend</span>}
                                                                                {isSelected && <CheckIcon size={11} />}
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {/* Zusatztrainer */}
                                                            <div>
                                                                <span className="block text-xs font-semibold text-emerald-700 mb-1">
                                                                    Zusatztrainer
                                                                </span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {coaches.map(coach => {
                                                                        const isSelected = editAdditionalCoachIds.includes(coach.id)
                                                                        const isAlreadyMandatory = editMandatoryCoachIds.includes(coach.id)
                                                                        const editAbsence = absenceMap.get(coach.id)
                                                                        return (
                                                                            <button
                                                                                key={coach.id}
                                                                                type="button"
                                                                                disabled={isAlreadyMandatory}
                                                                                onClick={() => {
                                                                                    setEditAdditionalCoachIds(prev =>
                                                                                        prev.includes(coach.id)
                                                                                            ? prev.filter(id => id !== coach.id)
                                                                                            : [...prev, coach.id]
                                                                                    )
                                                                                }}
                                                                                className={`px-2 py-1 rounded-md text-xs border transition flex items-center gap-1 cursor-pointer ${
                                                                                    isAlreadyMandatory
                                                                                        ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                                                                        : isSelected
                                                                                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                                                                        : 'bg-white border-slate-200 text-slate-700'
                                                                                }`}
                                                                            >
                                                                                <UserIcon size={12} />
                                                                                <span>{coach.name}</span>
                                                                                {editAbsence && <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded">Abwesend</span>}
                                                                                {isSelected && <CheckIcon size={11} />}
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* Normal-Ansicht */
                                                        <>
                                                            <p className="text-xs text-slate-600 mt-0.5">
                                                                {training.description || (
                                                                    <span className="italic text-slate-400">Keine Beschreibung</span>
                                                                )}
                                                            </p>

                                                            {training.coach_attendance && training.coach_attendance.length > 0 && (
                                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                                    {training.coach_attendance.some(ca => ca.is_mandatory) && (
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            <span className="text-[10px] font-bold text-blue-700 uppercase">Pflicht:</span>
                                                                            {training.coach_attendance.filter(ca => ca.is_mandatory).map(ca => {
                                                                                const coachAbsence = absenceMap.get(ca.coach_id)
                                                                                return (
                                                                                    <span key={ca.coach_id} className="inline-flex items-center gap-1 text-blue-800 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                                                                                        {ca.coaches?.name}
                                                                                        {coachAbsence && (
                                                                                            <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                                                                                ⚠️ Abwesend
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}

                                                                    {training.coach_attendance.some(ca => !ca.is_mandatory) && (
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            <span className="text-[10px] font-bold text-emerald-700 uppercase">Zusatz:</span>
                                                                            {training.coach_attendance.filter(ca => !ca.is_mandatory).map(ca => {
                                                                                const coachAbsence = absenceMap.get(ca.coach_id)
                                                                                return (
                                                                                    <span key={ca.coach_id} className="inline-flex items-center gap-1 text-emerald-800 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                                        {ca.coaches?.name}
                                                                                        {coachAbsence && (
                                                                                            <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                                                                                ⚠️ Abwesend
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateTraining(training.id)}
                                                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-xs flex items-center justify-center cursor-pointer shadow-xs"
                                                                title="Speichern"
                                                            >
                                                                <CheckIcon size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingId(null)
                                                                    setEditMandatoryCoachIds([])
                                                                    setEditAdditionalCoachIds([])
                                                                }}
                                                                className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition text-xs flex items-center justify-center cursor-pointer"
                                                                title="Abbrechen"
                                                            >
                                                                <XIcon size={15} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingId(training.id)
                                                                    setEditDescription(training.description || '')
                                                                    setEditMandatoryCoachIds(
                                                                        training.coach_attendance
                                                                            ?.filter(ca => ca.is_mandatory)
                                                                            .map(ca => ca.coach_id) ?? []
                                                                    )
                                                                    setEditAdditionalCoachIds(
                                                                        training.coach_attendance
                                                                            ?.filter(ca => !ca.is_mandatory)
                                                                            .map(ca => ca.coach_id) ?? []
                                                                    )
                                                                }}
                                                                className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg transition text-xs flex items-center justify-center cursor-pointer"
                                                                title="Bearbeiten"
                                                            >
                                                                <EditIcon size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={deletingId === training.id}
                                                                onClick={() => deleteTraining(training.id)}
                                                                className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg transition text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                                                                title="Löschen"
                                                            >
                                                                {deletingId === training.id ? (
                                                                    <SpinnerIcon size={15} />
                                                                ) : (
                                                                    <TrashIcon size={15} />
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
