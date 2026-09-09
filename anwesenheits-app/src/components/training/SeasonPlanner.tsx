import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Coach, CoachAbsence } from '../../types/interfaces'
import { useToast } from '../Toast'
import {
    CheckIcon,
    SpinnerIcon
} from '../Icons'
import {
    GERMAN_WEEKDAYS_SHORT,
    formatDateShortGerman,
    getCoachAbsenceMapForDate
} from '../../lib/absenceUtils'

interface SeasonPlannerProps {
    coaches: Coach[]
    absences: CoachAbsence[]
    existingDates: Set<string>
    onTrainingsCreated: () => void | Promise<void>
}

interface SeasonRow {
    date: string
    selected: boolean
    description: string
    coach1: string
    coach2: string
}

// Wandelt ein Date-Objekt zuverlässig in lokales YYYY-MM-DD um (ohne UTC-Verschiebung)
function formatLocalDate(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Parst ein YYYY-MM-DD Datum zur Mittagszeit (12:00:00), um Sommerzeit/UTC-Grenzprobleme auszuschließen
function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0)
}

// Ermittelt das nächste Datum für einen bestimmten Wochentag (0=So, 1=Mo, ..., 5=Fr)
function getNextDateForDay(dayOfWeek: number, fromDate = new Date()): string {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12, 0, 0)
    const currentDay = d.getDay() // 0 = So, 1 = Mo, ..., 5 = Fr
    let diff = dayOfWeek - currentDay
    if (diff < 0) {
        diff += 7
    }
    d.setDate(d.getDate() + diff)
    return formatLocalDate(d)
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo - So

export default function SeasonPlanner({
    coaches,
    absences,
    existingDates,
    onTrainingsCreated
}: SeasonPlannerProps) {
    const { toast } = useToast()

    // ── 1. Grundeinstellungen ──
    const [selectedWeekday, setSelectedWeekday] = useState<number>(5) // 5 = Freitag
    const [weeksCount, setWeeksCount] = useState<number>(8)
    const [startDate, setStartDate] = useState<string>(() => getNextDateForDay(5))

    // ── 2. Standard-Werte für alle Zeilen ──
    const [defaultDescription, setDefaultDescription] = useState<string>('Reguläres Training')
    const [defaultCoach1, setDefaultCoach1] = useState<string>('')
    const [defaultCoach2, setDefaultCoach2] = useState<string>('')

    // ── 3. Zeilen (alle Termine direkt im DOM anpassbar) ──
    const [rows, setRows] = useState<SeasonRow[]>([])
    const [saving, setSaving] = useState(false)

    // Wenn Wochentag geändert wird: Startdatum auf nächsten entsprechenden Tag setzen
    const handleWeekdayChange = (dayIdx: number) => {
        setSelectedWeekday(dayIdx)
        const nextDate = getNextDateForDay(dayIdx)
        setStartDate(nextDate)
    }

    // Wenn der Nutzer das Startdatum im Date-Input ändert
    const handleStartDateChange = (newVal: string) => {
        setStartDate(newVal)
        if (newVal) {
            const parsed = parseLocalDate(newVal)
            setSelectedWeekday(parsed.getDay())
        }
    }

    // Termine anhand von Wochentag, Startdatum und Wochenanzahl generieren
    useEffect(() => {
        if (!startDate || weeksCount <= 0) {
            setRows([])
            return
        }

        // Sicherstellen, dass das Startdatum exakt auf dem gewählten Wochentag liegt
        const base = parseLocalDate(startDate)
        const currentDay = base.getDay()
        let diff = selectedWeekday - currentDay
        if (diff < 0) {
            diff += 7
        }
        if (diff > 0) {
            base.setDate(base.getDate() + diff)
            setStartDate(formatLocalDate(base))
            return
        }

        const newRows: SeasonRow[] = []

        for (let i = 0; i < weeksCount; i++) {
            const cur = new Date(base)
            cur.setDate(base.getDate() + i * 7)
            const dateStr = formatLocalDate(cur)
            const isAlreadyCreated = existingDates.has(dateStr)

            // Falls bereits eine Zeile für dieses Datum existiert, Werte beibehalten
            const existingRow = rows.find(r => r.date === dateStr)

            newRows.push({
                date: dateStr,
                selected: existingRow ? existingRow.selected : !isAlreadyCreated,
                description: existingRow ? existingRow.description : defaultDescription,
                coach1: existingRow ? existingRow.coach1 : defaultCoach1,
                coach2: existingRow ? existingRow.coach2 : defaultCoach2
            })
        }

        setRows(newRows)
    }, [startDate, weeksCount, selectedWeekday])

    // Wenn Standard-Trainer oder Beschreibung geändert wird: noch nicht manuell geänderte Zeilen anpassen
    const applyDefaultsToAll = () => {
        setRows(prev =>
            prev.map(r => ({
                ...r,
                description: defaultDescription,
                coach1: defaultCoach1,
                coach2: defaultCoach2
            }))
        )
        toast.info('Standard-Trainer und Beschreibung auf alle Termine übertragen.')
    }

    // Zeilen-Handler
    const toggleRowSelected = (idx: number) => {
        setRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], selected: !copy[idx].selected }
            return copy
        })
    }

    const updateRowDescription = (idx: number, val: string) => {
        setRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], description: val }
            return copy
        })
    }

    const updateRowCoach1 = (idx: number, val: string) => {
        setRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], coach1: val }
            return copy
        })
    }

    const updateRowCoach2 = (idx: number, val: string) => {
        setRows(prev => {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], coach2: val }
            return copy
        })
    }

    const selectAll = () => {
        setRows(prev => prev.map(r => ({ ...r, selected: true })))
    }

    const deselectAll = () => {
        setRows(prev => prev.map(r => ({ ...r, selected: false })))
    }

    const selectedCount = useMemo(() => rows.filter(r => r.selected).length, [rows])

    // ── Speichern in Supabase ──
    const handleSave = async () => {
        const activeRows = rows.filter(r => r.selected)

        if (activeRows.length === 0) {
            toast.warning('Bitte wähle mindestens einen Termin aus.')
            return
        }

        setSaving(true)
        try {
            // 1. Trainings anlegen
            const trainingInserts = activeRows.map(r => ({
                date: r.date,
                description: r.description.trim() || null
            }))

            const { data: createdTrainings, error: trainingError } = await supabase
                .from('trainings')
                .insert(trainingInserts)
                .select()

            if (trainingError) {
                toast.error('Fehler beim Erstellen der Trainings: ' + trainingError.message)
                return
            }

            // 2. Trainerzuweisungen vorbereiten
            if (createdTrainings && createdTrainings.length > 0) {
                const coachAttendanceInserts: any[] = []

                createdTrainings.forEach(created => {
                    const row = activeRows.find(r => r.date === created.date)
                    if (row) {
                        const coachIds = [row.coach1, row.coach2].filter(Boolean)
                        // Dubletten entfernen (falls versehentlich 2x der gleiche Trainer gewählt wurde)
                        const uniqueIds = Array.from(new Set(coachIds))

                        uniqueIds.forEach(coachId => {
                            coachAttendanceInserts.push({
                                training_id: created.id,
                                coach_id: coachId,
                                is_present: true,
                                is_mandatory: true
                            })
                        })
                    }
                })

                if (coachAttendanceInserts.length > 0) {
                    const { error: coachError } = await supabase
                        .from('coach_attendance')
                        .insert(coachAttendanceInserts)

                    if (coachError) {
                        console.warn('Fehler bei Trainerzuweisung:', coachError)
                    }
                }
            }

            toast.success(`🎉 ${activeRows.length} Trainings erfolgreich angelegt!`)
            await onTrainingsCreated()
        } catch (err) {
            console.error('Saisonplanung Fehler:', err)
            toast.error('Unerwarteter Fehler beim Speichern.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* ── 1. Kompakte Konfiguration ── */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-4">
                {/* Wochentag & Dauer */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Wochentag */}
                    <div className="sm:col-span-5">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Wochentag
                        </label>
                        <div className="flex gap-1">
                            {WEEKDAY_ORDER.map(dayIdx => {
                                const isSelected = selectedWeekday === dayIdx
                                return (
                                    <button
                                        key={dayIdx}
                                        type="button"
                                        onClick={() => handleWeekdayChange(dayIdx)}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                        }`}
                                    >
                                        {GERMAN_WEEKDAYS_SHORT[dayIdx]}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Startdatum */}
                    <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Startdatum
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>

                    {/* Wochenanzahl */}
                    <div className="sm:col-span-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Dauer ({weeksCount} Wochen)
                            </label>
                        </div>
                        <div className="flex gap-1">
                            {[4, 8, 12, 16, 20].map(w => (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => setWeeksCount(w)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer text-center ${
                                        weeksCount === w
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {w}W
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Standard für alle Termine: Beschreibung & 2 Trainer */}
                <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">
                            Standard für alle Termine
                        </span>
                        <button
                            type="button"
                            onClick={applyDefaultsToAll}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                            Auf alle Termine anwenden
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Standard-Beschreibung */}
                        <div className="sm:col-span-5">
                            <input
                                type="text"
                                value={defaultDescription}
                                onChange={(e) => setDefaultDescription(e.target.value)}
                                placeholder="Beschreibung (z.B. Reguläres Training)"
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {/* Standard-Trainer 1 */}
                        <div className="sm:col-span-3">
                            <select
                                value={defaultCoach1}
                                onChange={(e) => setDefaultCoach1(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">-- Standard Trainer 1 --</option>
                                {coaches.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Standard-Trainer 2 */}
                        <div className="sm:col-span-4">
                            <select
                                value={defaultCoach2}
                                onChange={(e) => setDefaultCoach2(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">-- Standard Trainer 2 --</option>
                                {coaches.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 2. Termin-Liste (Jede Zeile direkt anpassbar, OHNE Ausklappen) ── */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                            Geplante Termine ({selectedCount} von {rows.length} aktiv)
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <button
                            type="button"
                            onClick={selectAll}
                            className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                            Alle auswählen
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            type="button"
                            onClick={deselectAll}
                            className="text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                            Keine auswählen
                        </button>
                    </div>
                </div>

                {/* Zeilen */}
                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                    {rows.map((row, idx) => {
                        const isAlreadyInDb = existingDates.has(row.date)
                        const rowAbsenceMap = getCoachAbsenceMapForDate(absences, row.date)
                        const coach1Absence = row.coach1 ? rowAbsenceMap.get(row.coach1) : null
                        const coach2Absence = row.coach2 ? rowAbsenceMap.get(row.coach2) : null
                        const d = parseLocalDate(row.date)
                        const weekdayStr = GERMAN_WEEKDAYS_SHORT[d.getDay()]

                        return (
                            <div
                                key={row.date}
                                className={`p-2.5 rounded-xl border transition ${
                                    !row.selected
                                        ? 'bg-slate-50 border-slate-200/60 opacity-50'
                                        : isAlreadyInDb
                                        ? 'bg-amber-50/40 border-amber-200'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                    {/* Datum & Checkbox */}
                                    <div className="sm:col-span-4 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={row.selected}
                                            onChange={() => toggleRowSelected(idx)}
                                            className="w-4 h-4 rounded text-blue-600 cursor-pointer shrink-0"
                                        />
                                        <span className={`text-xs font-bold shrink-0 ${row.selected ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {weekdayStr}, {formatDateShortGerman(row.date)}
                                        </span>
                                        {isAlreadyInDb && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium shrink-0">
                                                bereits in DB
                                            </span>
                                        )}
                                    </div>

                                    {/* Beschreibung */}
                                    <div className="sm:col-span-4">
                                        <input
                                            type="text"
                                            value={row.description}
                                            disabled={!row.selected}
                                            onChange={(e) => updateRowDescription(idx, e.target.value)}
                                            placeholder="Beschreibung..."
                                            className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                        />
                                    </div>

                                    {/* Trainer 1 & 2 */}
                                    <div className="sm:col-span-4 grid grid-cols-2 gap-1.5">
                                        {/* Trainer 1 */}
                                        <select
                                            value={row.coach1}
                                            disabled={!row.selected}
                                            onChange={(e) => updateRowCoach1(idx, e.target.value)}
                                            className={`w-full px-2 py-1 text-xs rounded-lg border focus:outline-none disabled:opacity-50 ${
                                                coach1Absence
                                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                        >
                                            <option value="">-- Trainer 1 --</option>
                                            {coaches.map(c => {
                                                const abs = rowAbsenceMap.get(c.id)
                                                return (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {abs ? '(🏖️ Abwesend)' : ''}
                                                    </option>
                                                )
                                            })}
                                        </select>

                                        {/* Trainer 2 */}
                                        <select
                                            value={row.coach2}
                                            disabled={!row.selected}
                                            onChange={(e) => updateRowCoach2(idx, e.target.value)}
                                            className={`w-full px-2 py-1 text-xs rounded-lg border focus:outline-none disabled:opacity-50 ${
                                                coach2Absence
                                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                        >
                                            <option value="">-- Trainer 2 --</option>
                                            {coaches.map(c => {
                                                const abs = rowAbsenceMap.get(c.id)
                                                return (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {abs ? '(🏖️ Abwesend)' : ''}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {/* Abwesenheits-Hinweis */}
                                {(coach1Absence || coach2Absence) && row.selected && (
                                    <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-1 pl-6">
                                        <span>⚠️</span>
                                        <span>
                                            {coach1Absence && `${coaches.find(c => c.id === row.coach1)?.name} ist an diesem Tag abwesend`}
                                            {coach1Absence && coach2Absence && ' | '}
                                            {coach2Absence && `${coaches.find(c => c.id === row.coach2)?.name} ist an diesem Tag abwesend`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* ── Speichern-Button ── */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">
                        {selectedCount > 0 ? (
                            <>Es werden <strong>{selectedCount} Trainings</strong> erstellt.</>
                        ) : (
                            <>Wähle mindestens einen Termin aus.</>
                        )}
                    </span>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || selectedCount === 0}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <SpinnerIcon size={16} />
                                <span>Erstelle Trainings...</span>
                            </>
                        ) : (
                            <>
                                <CheckIcon size={16} />
                                <span>{selectedCount} Trainings jetzt planen</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
