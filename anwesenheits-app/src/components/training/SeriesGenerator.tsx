import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Coach, CoachAbsence } from '../../types/interfaces'
import { useToast } from '../Toast'
import {
    CalendarIcon,
    CheckIcon,
    SpinnerIcon,
    UserIcon,
    UmbrellaIcon,
    ChevronRightIcon
} from '../Icons'
import {
    GERMAN_WEEKDAYS_SHORT,
    formatDateShortGerman,
    getCoachAbsenceMapForDate
} from '../../lib/absenceUtils'

interface SeriesGeneratorProps {
    coaches: Coach[]
    absences: CoachAbsence[]
    existingDates: Set<string>
    onTrainingsCreated: () => void
}

interface CustomDayConfig {
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

function addWeeksToDate(dateStr: string, weeks: number): string {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    return d.toISOString().split('T')[0]
}

export default function SeriesGenerator({
    coaches,
    absences,
    existingDates,
    onTrainingsCreated
}: SeriesGeneratorProps) {
    const { toast } = useToast()

    // 1. Wochentag(e) - Standard: Freitag (5)
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([5])

    // 2. Zeitraum
    const [startDate, setStartDate] = useState<string>(() => getNextDateForDayOfWeek(5))
    const [selectedPresetWeeks, setSelectedPresetWeeks] = useState<number>(8)
    const [endDate, setEndDate] = useState<string>(() => addWeeksToDate(getNextDateForDayOfWeek(5), 8))

    // 3. Progressive Disclosure Toggle: Optionale Felder versteckt
    const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false)
    const [defaultDescription, setDefaultDescription] = useState<string>('')
    const [defaultCoachIds, setDefaultCoachIds] = useState<string[]>([])

    // Individuelle Anpassung pro Datum
    const [customConfigs, setCustomConfigs] = useState<Record<string, CustomDayConfig>>({})
    const [expandedDetailDate, setExpandedDetailDate] = useState<string | null>(null)

    // Ausgewählte Tage in der Vorschau
    const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState<boolean>(false)

    // Wochentag an- / abwählen
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

    // Zeitraum Preset anpassen
    const handlePresetChange = (weeks: number) => {
        setSelectedPresetWeeks(weeks)
        if (startDate) {
            setEndDate(addWeeksToDate(startDate, weeks))
        }
    }

    // Startdatum anpassen
    const handleStartDateChange = (newStart: string) => {
        setStartDate(newStart)
        if (newStart && selectedPresetWeeks > 0) {
            setEndDate(addWeeksToDate(newStart, selectedPresetWeeks))
        }
    }

    // Termine berechnen
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

    // Wenn Termine neu berechnet werden, standardmäßig alle noch freien Tage anhaken
    useEffect(() => {
        const initialSelected = new Set<string>()
        for (const d of generatedDates) {
            if (!existingDates.has(d)) {
                initialSelected.add(d)
            }
        }
        setCheckedDates(initialSelected)
    }, [generatedDates, existingDates])

    // Toggle für einzelnen Tag in der Kachel-Vorschau
    const toggleDateTile = (dateStr: string) => {
        setCheckedDates(prev => {
            const next = new Set(prev)
            if (next.has(dateStr)) {
                next.delete(dateStr)
                if (expandedDetailDate === dateStr) {
                    setExpandedDetailDate(null)
                }
            } else {
                next.add(dateStr)
            }
            return next
        })
    }

    const selectAllNew = () => {
        const next = new Set<string>()
        for (const d of generatedDates) {
            if (!existingDates.has(d)) {
                next.add(d)
            }
        }
        setCheckedDates(next)
    }

    const deselectAll = () => {
        setCheckedDates(new Set())
        setExpandedDetailDate(null)
    }

    // Individuelle Notiz für ein Datum
    const updateDayDescription = (dateStr: string, text: string) => {
        setCustomConfigs(prev => ({
            ...prev,
            [dateStr]: {
                ...prev[dateStr],
                description: text
            }
        }))
    }

    // Individuelle Trainer für ein Datum
    const toggleDayCoach = (dateStr: string, coachId: string) => {
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

    // Batch speichern
    const handleSaveBatch = async () => {
        const datesToCreate = Array.from(checkedDates).sort()

        if (datesToCreate.length === 0) {
            toast.warning('Bitte wähle mindestens einen Termin in der Vorschau aus.')
            return
        }

        setSaving(true)
        try {
            // 1. Trainingszeilen mit individueller Beschreibung vorbereiten
            const trainingRows = datesToCreate.map(d => {
                const config = customConfigs[d]
                const itemDesc = (config?.description !== undefined) ? config.description : defaultDescription
                return {
                    date: d,
                    description: itemDesc.trim() || null
                }
            })

            // 2. Batch Insert in Supabase
            const { data: createdTrainings, error } = await supabase
                .from('trainings')
                .insert(trainingRows)
                .select()

            if (error) {
                toast.error('Fehler beim Anlegen der Trainings: ' + error.message)
                return
            }

            // 3. Trainerzuweisungen in coach_attendance
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

            toast.success(`🎉 ${datesToCreate.length} Trainings erfolgreich angelegt!`)
            onTrainingsCreated()
        } catch (err) {
            console.error('Batch-Create Fehler:', err)
            toast.error('Unerwarteter Fehler beim Anlegen der Trainings.')
        } finally {
            setSaving(false)
        }
    }

    // Prüfen, ob die Vorschau gerendert werden darf (UX-Regel 3)
    const isReadyForPreview = Boolean(
        startDate &&
        endDate &&
        selectedWeekdays.length > 0 &&
        generatedDates.length > 0
    )

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <CalendarIcon size={20} className="text-blue-600" />
                        Serien- & Saison-Generator
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                        Erstelle automatisch eine Serie von Trainingsterminen für Wochen oder Monate im Voraus.
                    </p>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* 1. Sektion: Wochentag auswählen (Standard: Freitag) */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            1. Wochentag(e)
                        </label>
                        <span className="text-xs text-slate-500">
                            Standard: <strong>Freitag</strong>
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
                                    className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${
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

                {/* 2. Sektion: Zeitraum festlegen */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        2. Zeitraum
                    </label>

                    {/* Presets */}
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

                    {/* Datums-Felder */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="block text-xs text-slate-500 mb-1 font-medium">Startdatum (ab)</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                            />
                        </div>
                        <div>
                            <span className="block text-xs text-slate-500 mb-1 font-medium">Enddatum (bis)</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value)
                                    setSelectedPresetWeeks(0)
                                }}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Sektion: Progressive Disclosure (Optionen standardmäßig versteckt) */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => setShowAdvancedOptions(prev => !prev)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition cursor-pointer py-1"
                    >
                        <span className={`transform transition duration-150 ${showAdvancedOptions ? 'rotate-90' : ''}`}>
                            <ChevronRightIcon size={14} />
                        </span>
                        <span>
                            {showAdvancedOptions ? 'Optionale Vorlagen verbergen' : '+ Erweiterte Optionen anzeigen (Beschreibung & Trainer)'}
                        </span>
                    </button>

                    {/* Aufklappbarer Optionsblock */}
                    {showAdvancedOptions && (
                        <div className="mt-3 p-4 bg-slate-50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Standard-Beschreibung */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Standard-Beschreibung (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={defaultDescription}
                                        onChange={(e) => setDefaultDescription(e.target.value)}
                                        placeholder="z. B. Reguläres Freitagstraining..."
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition mb-1.5"
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
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Standard-Trainer ({defaultCoachIds.length}/2)
                                    </label>
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
                    )}
                </div>

                {/* 4. Sektion: Terminvorschau & Bestätigung (STRICT PROGRESSIVE DISCLOSURE) */}
                {isReadyForPreview && (
                    <div className="pt-4 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span>3. Terminvorschau & Bestätigung</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-bold">
                                        {checkedDates.size} von {generatedDates.length} Terminen aktiv
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Tippe auf eine Kachel, um ein Training an- oder abzuwählen (z. B. bei Schulferien / Feiertagen):
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

                        {/* Interaktives Kachel-Grid (UX-Regel 4) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto pr-1">
                            {generatedDates.map(dateStr => {
                                const isAlreadyCreated = existingDates.has(dateStr)
                                const isChecked = checkedDates.has(dateStr)
                                const d = new Date(dateStr + 'T00:00:00')
                                const weekdayShort = GERMAN_WEEKDAYS_SHORT[d.getDay()]

                                // Trainer-Abwesenheiten an diesem Tag
                                const absenceMap = getCoachAbsenceMapForDate(absences, dateStr)
                                const activeCoaches = customConfigs[dateStr]?.coachIds ?? defaultCoachIds
                                const absentCoachNames: string[] = []
                                activeCoaches.forEach(cid => {
                                    if (absenceMap.has(cid)) {
                                        const c = coaches.find(co => co.id === cid)
                                        if (c) absentCoachNames.push(c.name)
                                    }
                                })

                                const isDetailOpen = expandedDetailDate === dateStr

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => !isAlreadyCreated && toggleDateTile(dateStr)}
                                        className={`p-3 rounded-xl border text-left transition relative select-none cursor-pointer flex flex-col justify-between min-h-[76px] ${
                                            isAlreadyCreated
                                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                                : isChecked
                                                ? 'bg-blue-50/80 border-blue-400 text-blue-950 shadow-2xs ring-1 ring-blue-400'
                                                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-90'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-1 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                    isChecked
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isChecked && <CheckIcon size={10} />}
                                                </span>
                                                <span className="text-xs font-bold leading-none">
                                                    {weekdayShort}
                                                </span>
                                            </div>

                                            {isAlreadyCreated ? (
                                                <span className="text-[9px] font-semibold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                                                    Vorhanden
                                                </span>
                                            ) : isChecked ? (
                                                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
                                                    Aktiv
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-slate-400">
                                                    Aus
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1">
                                            <span className="text-xs font-medium block text-slate-800">
                                                {formatDateShortGerman(dateStr)}
                                            </span>

                                            {absentCoachNames.length > 0 && isChecked && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-700 bg-purple-100 px-1 py-0.2 rounded font-medium mt-1">
                                                    <UmbrellaIcon size={10} />
                                                    <span>{absentCoachNames[0]} abwesend</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Klick auf Detail-Icon (optional) */}
                                        {isChecked && !isAlreadyCreated && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedDetailDate(prev => prev === dateStr ? null : dateStr)
                                                }}
                                                className="mt-1.5 text-[10px] text-blue-600 hover:text-blue-800 font-medium underline block"
                                            >
                                                {isDetailOpen ? 'Schließen' : 'Notiz / Trainer anpassen'}
                                            </button>
                                        )}

                                        {/* Eingeblendete Inline-Anpassung für diesen Tag */}
                                        {isDetailOpen && (
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-2 pt-2 border-t border-blue-200 text-left space-y-1.5 cursor-default"
                                            >
                                                <input
                                                    type="text"
                                                    value={customConfigs[dateStr]?.description ?? defaultDescription}
                                                    onChange={(e) => updateDayDescription(dateStr, e.target.value)}
                                                    placeholder="Notiz..."
                                                    className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-[11px] focus:outline-none"
                                                />

                                                <div className="flex flex-wrap gap-1">
                                                    {coaches.map(c => {
                                                        const activeCoaches = customConfigs[dateStr]?.coachIds ?? defaultCoachIds
                                                        const isSelected = activeCoaches.includes(c.id)
                                                        return (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => toggleDayCoach(dateStr, c.id)}
                                                                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                                                                    isSelected
                                                                        ? 'bg-blue-600 text-white font-bold'
                                                                        : 'bg-white text-slate-700 border border-slate-200'
                                                                }`}
                                                            >
                                                                {c.name}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer mit Speichern-Aktion */}
            {isReadyForPreview && (
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-600 text-center sm:text-left">
                        {checkedDates.size > 0 ? (
                            <>Es werden <strong>{checkedDates.size} Trainings</strong> in der Datenbank angelegt.</>
                        ) : (
                            <>Wähle oben Termine aus, um sie anzulegen.</>
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
            )}
        </div>
    )
}
