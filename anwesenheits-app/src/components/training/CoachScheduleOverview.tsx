import { useState, useMemo } from 'react'
import type { Coach, CoachAbsence } from '../../types/interfaces'
import type { TrainingWithCoaches } from '../../hooks/useTrainingPlanner'
import { useActiveCoach } from '../../hooks/useActiveCoach'
import {
    CalendarIcon,
    UserIcon,
    WarningIcon,
    ClipboardIcon
} from '../Icons'
import {
    formatDateGerman,
    isCoachAbsentOnDate
} from '../../lib/absenceUtils'

interface CoachScheduleOverviewProps {
    trainings: TrainingWithCoaches[]
    coaches: Coach[]
    absences: CoachAbsence[]
    onNavigateToPlan?: () => void
}

const GERMAN_DAYS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const GERMAN_MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function getRelativeDateLabel(dateStr: string, todayStr: string): string {
    if (dateStr === todayStr) return 'Heute'
    
    const d1 = new Date(dateStr + 'T00:00:00')
    const d2 = new Date(todayStr + 'T00:00:00')
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Morgen'
    if (diffDays === 2) return 'Übermorgen'
    if (diffDays > 2 && diffDays <= 7) return `In ${diffDays} Tagen`
    if (diffDays > 7 && diffDays <= 14) return 'Nächste Woche'
    if (diffDays < 0) return 'Vergangen'
    return ''
}

export default function CoachScheduleOverview({
    trainings,
    coaches,
    absences,
    onNavigateToPlan
}: CoachScheduleOverviewProps) {
    const { activeCoachId, setActiveCoach } = useActiveCoach()
    const todayStr = new Date().toISOString().split('T')[0]

    // Filter: 'all' oder konkrete Coach-ID
    const [selectedCoachFilter, setSelectedCoachFilter] = useState<string>(() => {
        return activeCoachId || (coaches.length > 0 ? coaches[0].id : 'all')
    })

    // Zeitfilter: 'upcoming' (Standard, ab heute) vs. 'all'
    const [timeFilter, setTimeFilter] = useState<'upcoming' | 'all'>('upcoming')

    // Filtern der Trainings
    const relevantTrainings = useMemo(() => {
        let list = [...trainings]

        // Zeitfilter anwenden
        if (timeFilter === 'upcoming') {
            list = list.filter(t => t.date >= todayStr)
        }

        // Trainerfilter anwenden
        if (selectedCoachFilter !== 'all') {
            list = list.filter(t => {
                const assigned = t.coach_attendance || []
                return assigned.some(ca => ca.coach_id === selectedCoachFilter)
            })
        }

        // Sortieren nach Datum aufsteigend
        return list.sort((a, b) => a.date.localeCompare(b.date))
    }, [trainings, selectedCoachFilter, timeFilter, todayStr])

    // Statistiken für den ausgewählten Trainer berechnen
    const stats = useMemo(() => {
        let totalAssigned = 0
        let mandatoryCount = 0
        let additionalCount = 0

        const futureTrainings = trainings.filter(t => t.date >= todayStr)

        futureTrainings.forEach(t => {
            const assigned = t.coach_attendance || []
            if (selectedCoachFilter === 'all') {
                if (assigned.length > 0) totalAssigned++
                mandatoryCount += assigned.filter(a => a.is_mandatory).length
                additionalCount += assigned.filter(a => !a.is_mandatory).length
            } else {
                const myAssignment = assigned.find(a => a.coach_id === selectedCoachFilter)
                if (myAssignment) {
                    totalAssigned++
                    if (myAssignment.is_mandatory) mandatoryCount++
                    else additionalCount++
                }
            }
        })

        return { totalAssigned, mandatoryCount, additionalCount }
    }, [trainings, selectedCoachFilter, todayStr])

    const selectedCoachObj = coaches.find(c => c.id === selectedCoachFilter)

    return (
        <div className="space-y-6">
            {/* ── Filter & Trainer-Identität ── */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                            <ClipboardIcon size={24} />
                        </span>
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg">
                                Trainer-Einteilungsplan
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500">
                                Übersicht aller eingeteilten Trainingseinheiten
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {/* Trainer-Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs flex-1 sm:flex-none justify-between sm:justify-start">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <UserIcon size={16} className="text-blue-600 shrink-0" />
                                <span className="font-medium text-slate-600 shrink-0">Trainer:</span>
                            </div>
                            <select
                                value={selectedCoachFilter}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setSelectedCoachFilter(val)
                                    if (val !== 'all') {
                                        setActiveCoach(val)
                                    }
                                }}
                                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-right sm:text-left truncate ml-1 max-w-[150px] sm:max-w-none"
                            >
                                <option value="all">Alle Trainer</option>
                                {coaches.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.id === activeCoachId ? '(Du)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Zeitfilter: Anstehend vs. Alle */}
                        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0 gap-1">
                            <button
                                type="button"
                                onClick={() => setTimeFilter('upcoming')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-center ${
                                    timeFilter === 'upcoming'
                                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Anstehend
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeFilter('all')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-center ${
                                    timeFilter === 'all'
                                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Alle
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── KPI Kacheln ── */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-5 pt-4 border-t border-slate-100">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-center">
                        <span className="text-xl sm:text-2xl font-extrabold text-blue-700 block">
                            {stats.totalAssigned}
                        </span>
                        <span className="text-[11px] sm:text-xs text-blue-900/70 font-medium">
                            {selectedCoachFilter === 'all' ? 'Geplante Einheiten' : 'Eingeteilt'}
                        </span>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-center">
                        <span className="text-xl sm:text-2xl font-extrabold text-amber-700 block">
                            {stats.mandatoryCount}
                        </span>
                        <span className="text-[11px] sm:text-xs text-amber-900/70 font-medium">
                            Pflichttrainer
                        </span>
                    </div>

                    <div className="bg-green-50/60 border border-green-100 rounded-xl p-3 text-center">
                        <span className="text-xl sm:text-2xl font-extrabold text-green-700 block">
                            {stats.additionalCount}
                        </span>
                        <span className="text-[11px] sm:text-xs text-green-900/70 font-medium">
                            Zusatztrainer
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Liste der Einteilungen ── */}
            {relevantTrainings.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
                    <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CalendarIcon size={28} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-base mb-1">
                        Keine Trainings gefunden
                    </h3>
                    <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mb-4">
                        {selectedCoachFilter === 'all'
                            ? 'Aktuell sind in diesem Zeitraum keine Trainings mit Trainerzuweisung eingetragen.'
                            : `${selectedCoachObj?.name || 'Dieser Trainer'} ist für keine anstehenden Einheiten eingeteilt.`}
                    </p>
                    {onNavigateToPlan && (
                        <button
                            type="button"
                            onClick={onNavigateToPlan}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                            Training planen / Trainer zuweisen
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {relevantTrainings.map(training => {
                        const dateObj = new Date(training.date + 'T00:00:00')
                        const weekdayName = GERMAN_DAYS_FULL[dateObj.getDay()]
                        const dayNum = dateObj.getDate()
                        const monthName = GERMAN_MONTHS_SHORT[dateObj.getMonth()]
                        const relativeLabel = getRelativeDateLabel(training.date, todayStr)
                        const isPast = training.date < todayStr

                        const assignedCoaches = training.coach_attendance || []
                        const myAssignment = selectedCoachFilter === 'all'
                            ? null
                            : assignedCoaches.find(ca => ca.coach_id === selectedCoachFilter)

                        // Konfliktprüfung: Ist der Trainer an diesem Tag abwesend gemeldet?
                        const conflictingCoaches = assignedCoaches.filter(ca => {
                            const absence = absences.find(a => a.coach_id === ca.coach_id && isCoachAbsentOnDate(a, training.date))
                            return Boolean(absence)
                        })

                        return (
                            <div
                                key={training.id}
                                className={`bg-white rounded-2xl p-4 sm:p-5 border transition shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                    isPast
                                        ? 'opacity-65 border-slate-200'
                                        : 'border-slate-200 hover:border-blue-300'
                                }`}
                            >
                                {/* Datum Block & Info */}
                                <div className="flex items-start gap-4">
                                    {/* Kalender-Badge */}
                                    <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                                        <span className="text-[10px] sm:text-xs uppercase font-bold text-blue-600 leading-none">
                                            {monthName}
                                        </span>
                                        <span className="text-xl sm:text-2xl font-extrabold text-blue-900 leading-tight">
                                            {dayNum}
                                        </span>
                                        <span className="text-[9px] text-blue-500 font-semibold leading-none">
                                            {weekdayName.slice(0, 2)}
                                        </span>
                                    </div>

                                    {/* Text-Details */}
                                    <div className="space-y-1 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-slate-900 text-sm sm:text-base">
                                                {weekdayName}, {formatDateGerman(training.date)}
                                            </span>
                                            {relativeLabel && (
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                    relativeLabel === 'Heute'
                                                        ? 'bg-green-100 text-green-800'
                                                        : relativeLabel === 'Morgen'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {relativeLabel}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs sm:text-sm text-slate-600 font-medium">
                                            {training.description || 'Reguläres Vereinstraining'}
                                        </p>

                                        {/* Wenn für bestimmten Trainer gefiltert: seine Rolle hervorheben */}
                                        {myAssignment && (
                                            <div className="pt-1 flex items-center gap-1.5">
                                                <span className="text-xs text-slate-500">Deine Einteilung:</span>
                                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                                    myAssignment.is_mandatory
                                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                        : 'bg-green-100 text-green-800 border-green-200'
                                                }`}>
                                                    {myAssignment.is_mandatory ? '⭐ Pflichttrainer' : '✓ Zusatztrainer'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Konflikt-Warnung falls Trainer abwesend */}
                                        {conflictingCoaches.length > 0 && (
                                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                                                <WarningIcon size={16} className="text-amber-600 shrink-0" />
                                                <span>
                                                    <strong>Achtung:</strong>{' '}
                                                    {conflictingCoaches.map(c => c.coaches?.name || 'Trainer').join(', ')}{' '}
                                                    ist an diesem Tag als abwesend gemeldet!
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Eingeteilte Trainer Badges */}
                                <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                                        Eingeteilt ({assignedCoaches.length}):
                                    </span>
                                    <div className="flex flex-wrap sm:justify-end gap-1.5">
                                        {assignedCoaches.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic">
                                                Keine Trainer zugewiesen
                                            </span>
                                        ) : (
                                            assignedCoaches.map(ca => {
                                                const coachName = ca.coaches?.name || 'Trainer'
                                                const isHighlighted = ca.coach_id === selectedCoachFilter

                                                return (
                                                    <span
                                                        key={ca.coach_id}
                                                        className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1 font-semibold ${
                                                            isHighlighted
                                                                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                                                : ca.is_mandatory
                                                                ? 'bg-slate-100 text-slate-800 border-slate-200'
                                                                : 'bg-green-50 text-green-800 border-green-200'
                                                        }`}
                                                    >
                                                        <span>{coachName}</span>
                                                        <span className="text-[10px] opacity-75">
                                                            ({ca.is_mandatory ? 'Pflicht' : 'Zusatz'})
                                                        </span>
                                                    </span>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
