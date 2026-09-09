import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach, CoachAbsence, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import {
    CalendarIcon,
    PlusIcon,
    CheckIcon,
    SpinnerIcon,
    UserIcon
} from '../components/Icons'
import {
    GERMAN_WEEKDAYS,
    GERMAN_WEEKDAYS_SHORT,
    formatDateShortGerman,
    getCoachAbsenceMapForDate
} from '../lib/absenceUtils'

interface BatchTrainingPlannerProps {
    onTrainingsCreated?: () => void
    existingTrainings?: Training[]
    coaches?: Coach[]
    absences?: CoachAbsence[]
}

interface CustomTrainingConfig {
    description?: string
    coachIds?: string[]
}

const PRESET_WEEKS = [
    { label: '4 Wochen (1 Monat)', weeks: 4 },
    { label: '8 Wochen (2 Monate)', weeks: 8 },
    { label: '12 Wochen (Quartal)', weeks: 12 },
    { label: '20 Wochen (Halbjahr)', weeks: 20 },
]

const QUICK_DESCRIPTIONS = [
    'Reguläres Training',
    'Schülertraining',
    'Meisterschaftsvorbereitung',
    'Freies Spiel',
]

// Berechnet den nächsten Wochentag (0=So, 1=Mo, ..., 5=Fr)
function getNextDateForDayOfWeek(dayOfWeek: number, fromDate = new Date()): string {
    const d = new Date(fromDate)
    const currentDay = d.getDay()
    let diff = dayOfWeek - currentDay
    if (diff < 0) {
        diff += 7
    }
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
}

// Berechnet Enddatum anhand von Startdatum und Wochen
function addWeeksToDate(dateStr: string, weeks: number): string {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    return d.toISOString().split('T')[0]
}

export default function BatchTrainingPlanner({
    onTrainingsCreated,
    existingTrainings = [],
    coaches: initialCoaches = [],
    absences: initialAbsences = []
}: BatchTrainingPlannerProps) {
    const { toast } = useToast()

    // Lokale Daten, falls nicht übergeben
    const [coaches, setCoaches] = useState<Coach[]>(initialCoaches)
    const [absences, setAbsences] = useState<CoachAbsence[]>(initialAbsences)
    const [existingDates, setExistingDates] = useState<Set<string>>(
        () => new Set(existingTrainings.map(t => t.date))
    )

    // Formular-Zustand (Standard: Freitag = 5)
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([5])
    const [startDate, setStartDate] = useState<string>(() => getNextDateForDayOfWeek(5))
    const [selectedPresetWeeks, setSelectedPresetWeeks] = useState<number>(8)
    const [endDate, setEndDate] = useState<string>(() => addWeeksToDate(getNextDateForDayOfWeek(5), 8))

    // Globale Standard-Werte
    const [defaultDescription, setDefaultDescription] = useState<string>('Reguläres Freitagstraining')
    const [defaultCoachIds, setDefaultCoachIds] = useState<string[]>([])

    // Individuelle Konfigurationen pro Datum (eigene Beschreibung & eigene Trainer)
    const [customConfigs, setCustomConfigs] = useState<Record<string, CustomTrainingConfig>>({})

    // Ausgewählte Tage in der Checkliste
    const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [quickAdding, setQuickAdding] = useState(false)

    // Daten nachladen falls nötig
    useEffect(() => {
        if (coaches.length === 0) {
            supabase
                .from('coaches')
                .select('*')
                .eq('active', true)
                .order('name')
                .then(({ data }) => {
                    if (data) setCoaches(data)
                })
        }
        if (absences.length === 0) {
            supabase
                .from('coach_absences')
                .select('*')
                .then(({ data, error }) => {
                    if (!error && data) {
                        setAbsences(data as CoachAbsence[])
                    }
                })
        }
        if (existingTrainings.length === 0) {
            supabase
                .from('trainings')
                .select('date')
                .then(({ data }) => {
                    if (data) {
                        setExistingDates(new Set(data.map(t => t.date)))
                    }
                })
        } else {
            setExistingDates(new Set(existingTrainings.map(t => t.date)))
        }
    }, [existingTrainings])

    // Wenn Preset geändert wird, Enddatum anpassen
    const handlePresetChange = (weeks: number) => {
        setSelectedPresetWeeks(weeks)
        if (startDate) {
            setEndDate(addWeeksToDate(startDate, weeks))
        }
    }

    // Wenn Startdatum geändert wird, Enddatum synchron halten
    const handleStartDateChange = (newStart: string) => {
        setStartDate(newStart)
        if (newStart && selectedPresetWeeks > 0) {
            setEndDate(addWeeksToDate(newStart, selectedPresetWeeks))
        }
    }

    // Wochentag umschalten
    const toggleWeekday = (day: number) => {
        setSelectedWeekdays(prev => {
            if (prev.includes(day)) {
                if (prev.length === 1) {
                    toast.info('Mindestens ein Wochentag muss ausgewählt bleiben.')
                    return prev
                }
                return prev.filter(d => d !== day)
            } else {
                return [...prev, day].sort()
            }
        })
    }

    // Alle Termine im Zeitraum für die ausgewählten Wochentage berechnen
    const generatedDates = useMemo(() => {
        if (!startDate || !endDate || selectedWeekdays.length === 0) return []
        const result: string[] = []
        const current = new Date(startDate + 'T00:00:00')
        const end = new Date(endDate + 'T00:00:00')

        let safety = 0
        while (current <= end && safety < 730) {
            safety++
            const dayOfWeek = current.getDay()
            if (selectedWeekdays.includes(dayOfWeek)) {
                result.push(current.toISOString().split('T')[0])
            }
            current.setDate(current.getDate() + 1)
        }
        return result
    }, [startDate, endDate, selectedWeekdays])

    // Standard-Auswahl aktualisieren, wenn Termine neu berechnet werden
    useEffect(() => {
        const initialSelected = new Set<string>()
        for (const d of generatedDates) {
            if (!existingDates.has(d)) {
                initialSelected.add(d)
            }
        }
        setCheckedDates(initialSelected)
    }, [generatedDates, existingDates])

    // Toggle Checkbox für ein einzelnes Datum
    const toggleDate = (dateStr: string) => {
        setCheckedDates(prev => {
            const next = new Set(prev)
            if (next.has(dateStr)) {
                next.delete(dateStr)
            } else {
                next.add(dateStr)
            }
            return next
        })
    }

    // Alle freien auswählen
    const selectAllNew = () => {
        const next = new Set<string>()
        for (const d of generatedDates) {
            if (!existingDates.has(d)) {
                next.add(d)
            }
        }
        setCheckedDates(next)
    }

    // Keine auswählen
    const deselectAll = () => {
        setCheckedDates(new Set())
    }

    // Individuelle Beschreibung für einen spezifischen Tag aktualisieren
    const updateItemDescription = (dateStr: string, text: string) => {
        setCustomConfigs(prev => ({
            ...prev,
            [dateStr]: {
                ...prev[dateStr],
                description: text
            }
        }))
    }

    // Individuellen Trainer für einen spezifischen Tag an/abwählen
    const toggleItemCoach = (dateStr: string, coachId: string) => {
        setCustomConfigs(prev => {
            const currentCoaches = prev[dateStr]?.coachIds !== undefined
                ? prev[dateStr].coachIds!
                : defaultCoachIds

            let newCoaches: string[]
            if (currentCoaches.includes(coachId)) {
                newCoaches = currentCoaches.filter(id => id !== coachId)
            } else {
                if (currentCoaches.length >= 2) {
                    toast.info('Maximal 2 Pflichttrainer pro Training möglich.')
                    return prev
                }
                newCoaches = [...currentCoaches, coachId]
            }

            return {
                ...prev,
                [dateStr]: {
                    ...prev[dateStr],
                    coachIds: newCoaches
                }
            }
        })
    }

    // Standardwerte auf alle Termine anwenden
    const applyGlobalToAll = () => {
        const updated: Record<string, CustomTrainingConfig> = {}
        for (const d of generatedDates) {
            updated[d] = {
                description: defaultDescription,
                coachIds: [...defaultCoachIds]
            }
        }
        setCustomConfigs(updated)
        toast.success('Standard-Werte auf alle Termine übertragen!')
    }

    // Nächster freier Freitag für den 1-Klick-Button
    const nextFreeFriday = useMemo(() => {
        let testDate = new Date()
        for (let i = 0; i < 30; i++) {
            const dateStr = getNextDateForDayOfWeek(5, testDate)
            if (!existingDates.has(dateStr)) {
                return dateStr
            }
            const nextDay = new Date(dateStr + 'T00:00:00')
            nextDay.setDate(nextDay.getDate() + 1)
            testDate = nextDay
        }
        return null
    }, [existingDates])

    // 1-Klick Quick-Add für den nächsten Freitag
    const handleQuickAddFriday = async () => {
        if (!nextFreeFriday) {
            toast.info('Alle Freitage im nächsten Monat sind bereits geplant.')
            return
        }

        setQuickAdding(true)
        try {
            const { data, error } = await supabase
                .from('trainings')
                .insert({
                    date: nextFreeFriday,
                    description: defaultDescription.trim() || 'Reguläres Freitagstraining'
                })
                .select()
                .single()

            if (error) {
                toast.error('Fehler beim Erstellen: ' + error.message)
                return
            }

            if (defaultCoachIds.length > 0 && data) {
                const coachInserts = defaultCoachIds.map(coachId => ({
                    training_id: data.id,
                    coach_id: coachId,
                    is_present: true,
                    is_mandatory: true
                }))
                await supabase.from('coach_attendance').insert(coachInserts)
            }

            setExistingDates(prev => new Set([...prev, nextFreeFriday]))
            toast.success(`Training für ${formatDateShortGerman(nextFreeFriday)} erfolgreich erstellt!`)
            onTrainingsCreated?.()
        } catch (err) {
            console.error('Quick-Add Fehler:', err)
            toast.error('Unerwarteter Fehler beim Erstellen.')
        } finally {
            setQuickAdding(false)
        }
    }

    // Batch-Erstellung aller ausgewählten Termine
    const handleSaveBatch = async () => {
        const datesToCreate = Array.from(checkedDates).sort()

        if (datesToCreate.length === 0) {
            toast.warning('Bitte wähle mindestens einen Termin in der Vorschau aus.')
            return
        }

        setSaving(true)
        try {
            // 1. Alle Trainings vorbereiten mit jeweiliger individueller Beschreibung
            const trainingRows = datesToCreate.map(d => {
                const config = customConfigs[d]
                const itemDesc = (config?.description !== undefined) ? config.description : defaultDescription
                return {
                    date: d,
                    description: itemDesc.trim() || null
                }
            })

            // 2. Batch-Insert der Trainings
            const { data: createdTrainings, error } = await supabase
                .from('trainings')
                .insert(trainingRows)
                .select()

            if (error) {
                toast.error('Fehler beim Anlegen der Trainings: ' + error.message)
                return
            }

            // 3. Trainerzuweisungen pro Training anlegen
            if (createdTrainings && createdTrainings.length > 0) {
                const coachRows: { training_id: string; coach_id: string; is_present: boolean; is_mandatory: boolean }[] = []
                for (const t of createdTrainings) {
                    const config = customConfigs[t.date]
                    const assignedCoaches = (config?.coachIds !== undefined) ? config.coachIds : defaultCoachIds
                    for (const coachId of assignedCoaches) {
                        coachRows.push({
                            training_id: t.id,
                            coach_id: coachId,
                            is_present: true,
                            is_mandatory: true
                        })
                    }
                }
                if (coachRows.length > 0) {
                    const { error: coachErr } = await supabase
                        .from('coach_attendance')
                        .insert(coachRows)

                    if (coachErr) {
                        console.warn('Fehler bei Trainerzuweisung:', coachErr)
                    }
                }
            }

            // Lokales Set aktualisieren
            setExistingDates(prev => {
                const next = new Set(prev)
                datesToCreate.forEach(d => next.add(d))
                return next
            })

            toast.success(`🎉 ${datesToCreate.length} Trainings erfolgreich angelegt!`)
            onTrainingsCreated?.()
        } catch (err) {
            console.error('Batch-Create Fehler:', err)
            toast.error('Unerwarteter Fehler beim Anlegen der Trainings.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── 1. SCHNELL-MODUS: 1-Klick Nächster Freitag ── */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="p-1.5 bg-white/20 rounded-xl">
                            <CalendarIcon size={18} />
                        </span>
                        <h2 className="text-base font-bold">1-Klick Schnell-Planung</h2>
                    </div>
                    <p className="text-xs text-blue-100">
                        {nextFreeFriday ? (
                            <>Nächster freier Freitag ist der <strong>{formatDateShortGerman(nextFreeFriday)}</strong>.</>
                        ) : (
                            <>Alle Freitage der nächsten Wochen sind bereits verplant.</>
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleQuickAddFriday}
                    disabled={quickAdding || !nextFreeFriday}
                    className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                    {quickAdding ? (
                        <>
                            <SpinnerIcon size={16} />
                            <span>Wird angelegt...</span>
                        </>
                    ) : (
                        <>
                            <PlusIcon size={16} />
                            <span>{nextFreeFriday ? `+ Freitag (${formatDateShortGerman(nextFreeFriday)}) anlegen` : 'Kein freier Freitag'}</span>
                        </>
                    )}
                </button>
            </div>

            {/* ── 2. SERIEN-GENERATOR (Saison-Planer) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <CalendarIcon size={20} className="text-blue-600" />
                            Serien- & Saison-Generator
                        </h2>
                        <p className="text-xs text-slate-500">
                            Mehrere Trainings auf einmal generieren mit individuellen Trainern & Beschreibungen
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Sektion A: Wochentag auswählen (Standard: Freitag) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                1. Wochentag(e) auswählen
                            </label>
                            <span className="text-xs text-slate-500">
                                Standard: <strong>Freitag</strong> (Mehrfachauswahl möglich)
                            </span>
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                const isSelected = selectedWeekdays.includes(dayIdx)
                                const isDefaultFriday = dayIdx === 5
                                return (
                                    <button
                                        key={dayIdx}
                                        type="button"
                                        onClick={() => toggleWeekday(dayIdx)}
                                        className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex flex-col items-center gap-1 ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <span>{GERMAN_WEEKDAYS_SHORT[dayIdx]}</span>
                                        {isDefaultFriday && !isSelected && (
                                            <span className="text-[10px] text-blue-600 font-normal">Default</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Sektion B: Zeitraum / Presets */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            2. Zeitraum festlegen
                        </label>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                            {PRESET_WEEKS.map(p => {
                                const isSelected = selectedPresetWeeks === p.weeks
                                return (
                                    <button
                                        key={p.weeks}
                                        type="button"
                                        onClick={() => handlePresetChange(p.weeks)}
                                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer text-center ${
                                            isSelected
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-400 shadow-2xs'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="block text-xs text-slate-500 mb-1">Startdatum (ab)</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => handleStartDateChange(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                />
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 mb-1">Enddatum (bis)</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value)
                                        setSelectedPresetWeeks(0)
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sektion C: Standard-Werte für die Serie (Vorlage) */}
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    3. Standard-Vorlage für alle Termine
                                </span>
                                <span className="text-xs text-slate-500">
                                    Dient als Ausgangswert. Du kannst unten jeden Termin noch individuell anpassen!
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={applyGlobalToAll}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                            >
                                Auf alle Termine übertragen
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Standard-Beschreibung */}
                            <div>
                                <span className="block text-xs font-medium text-slate-600 mb-1">
                                    Standard-Beschreibung
                                </span>
                                <input
                                    type="text"
                                    value={defaultDescription}
                                    onChange={(e) => setDefaultDescription(e.target.value)}
                                    placeholder="z. B. Reguläres Freitagstraining..."
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition mb-1.5"
                                />
                                <div className="flex flex-wrap gap-1">
                                    {QUICK_DESCRIPTIONS.map(desc => (
                                        <button
                                            key={desc}
                                            type="button"
                                            onClick={() => setDefaultDescription(desc)}
                                            className={`px-2 py-0.5 text-[11px] rounded-lg transition cursor-pointer border ${
                                                defaultDescription === desc
                                                    ? 'bg-blue-100 border-blue-400 text-blue-800 font-semibold'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {desc}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Standard-Trainer */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-slate-600">
                                        Standard-Trainer ({defaultCoachIds.length}/2)
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {coaches.map(c => {
                                        const isSelected = defaultCoachIds.includes(c.id)
                                        const isDisabled = !isSelected && defaultCoachIds.length >= 2
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => {
                                                    setDefaultCoachIds(prev =>
                                                        prev.includes(c.id)
                                                            ? prev.filter(id => id !== c.id)
                                                            : [...prev, c.id]
                                                    )
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                                                        : isDisabled
                                                        ? 'opacity-40 bg-white border-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                <UserIcon size={12} />
                                                <span>{c.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sektion D: Interaktive Terminvorschau mit individuellen Trainern & Beschreibungen */}
                    <div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span>4. Terminvorschau & individuelle Anpassung</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-bold">
                                        {checkedDates.size} von {generatedDates.length} Terminen aktiv
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Hier kannst du für jedes Training eine eigene Beschreibung und individuelle Trainer vergeben:
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={selectAllNew}
                                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                >
                                    Alle freien wählen
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={deselectAll}
                                    className="text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                    Keine wählen
                                </button>
                            </div>
                        </div>

                        {generatedDates.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-sm">
                                Keine Termine im gewählten Zeitraum gefunden. Bitte prüfe das Start- und Enddatum.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                                {generatedDates.map(dateStr => {
                                    const isAlreadyCreated = existingDates.has(dateStr)
                                    const isChecked = checkedDates.has(dateStr)
                                    const d = new Date(dateStr + 'T00:00:00')
                                    const weekdayName = GERMAN_WEEKDAYS[d.getDay()]

                                    // Individuelle Werte für diesen konkreten Tag (oder Fallback auf Standard)
                                    const itemConfig = customConfigs[dateStr]
                                    const currentDesc = itemConfig?.description !== undefined
                                        ? itemConfig.description
                                        : defaultDescription
                                    const currentCoaches = itemConfig?.coachIds !== undefined
                                        ? itemConfig.coachIds
                                        : defaultCoachIds

                                    // Abwesenheiten an DIESEM Datum
                                    const absenceMap = getCoachAbsenceMapForDate(absences, dateStr)

                                    return (
                                        <div
                                            key={dateStr}
                                            className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                                                isAlreadyCreated
                                                    ? 'bg-slate-100 border-slate-200 opacity-60'
                                                    : isChecked
                                                    ? 'bg-white border-blue-400 shadow-xs ring-1 ring-blue-300'
                                                    : 'bg-slate-50/60 border-slate-200 opacity-70'
                                            }`}
                                        >
                                            {/* Header der Karte: Checkbox & Datum */}
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        disabled={isAlreadyCreated}
                                                        onChange={() => toggleDate(dateStr)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                                                            {weekdayName}, {formatDateShortGerman(dateStr)}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {isAlreadyCreated ? 'Bereits in Datenbank vorhanden' : isChecked ? 'Wird erstellt' : 'Abgewählt (überspringen)'}
                                                        </span>
                                                    </div>
                                                </label>

                                                {isAlreadyCreated ? (
                                                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                                        Bereits vorhanden
                                                    </span>
                                                ) : isChecked ? (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                                        Aktiv
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Individuelle Felder für dieses spezifische Training (nur wenn aktiv & neu) */}
                                            {isChecked && !isAlreadyCreated && (
                                                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                                                    {/* 1. Eigene Beschreibung für diesen Tag */}
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                            Beschreibung für diesen Tag:
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={currentDesc}
                                                            onChange={(e) => updateItemDescription(dateStr, e.target.value)}
                                                            placeholder="z. B. Aufschlagtraining, Meisterschaft..."
                                                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                                        />
                                                    </div>

                                                    {/* 2. Eigene Trainer-Zuweisung für diesen Tag */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[11px] font-semibold text-slate-600">
                                                                Trainer ({currentCoaches.length}/2):
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-wrap gap-1">
                                                            {coaches.map(coach => {
                                                                const isSelected = currentCoaches.includes(coach.id)
                                                                const isDisabled = !isSelected && currentCoaches.length >= 2
                                                                const coachAbsence = absenceMap.get(coach.id)

                                                                return (
                                                                    <button
                                                                        key={coach.id}
                                                                        type="button"
                                                                        disabled={isDisabled}
                                                                        onClick={() => toggleItemCoach(dateStr, coach.id)}
                                                                        title={coachAbsence ? `Achtung: ${coach.name} ist an diesem Tag abwesend (${coachAbsence.reason || 'Abwesend'})` : undefined}
                                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 border ${
                                                                            isSelected
                                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                                                                                : isDisabled
                                                                                ? 'opacity-35 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                                                                : coachAbsence
                                                                                ? 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
                                                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        <UserIcon size={11} />
                                                                        <span>{coach.name}</span>
                                                                        {coachAbsence && (
                                                                            <span className="text-[10px]" title="Trainer abwesend">🏖️</span>
                                                                        )}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky / Fixed Footer mit Erstellen-Button */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-600 text-center sm:text-left">
                        {checkedDates.size > 0 ? (
                            <>Es werden <strong>{checkedDates.size} Trainings</strong> mit den jeweiligen Trainern und Beschreibungen gespeichert.</>
                        ) : (
                            <>Wähle oben Termine aus, um sie zu erstellen.</>
                        )}
                    </p>

                    <button
                        type="button"
                        onClick={handleSaveBatch}
                        disabled={saving || checkedDates.size === 0}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <SpinnerIcon size={16} />
                                <span>Trainings werden erstellt...</span>
                            </>
                        ) : (
                            <>
                                <CheckIcon size={16} />
                                <span>{checkedDates.size} Trainings jetzt erstellen</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
