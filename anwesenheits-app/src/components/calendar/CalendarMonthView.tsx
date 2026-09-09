import { useState } from 'react'
import type { CoachAbsence, Training } from '../../types/interfaces'
import { PlusIcon, EditIcon } from '../Icons'
import {
    GERMAN_WEEKDAYS_SHORT,
    getDayOfWeekFromDateString,
    isCoachAbsentOnDate,
    getAbsenceTheme,
    cleanReasonText
} from '../../lib/absenceUtils'

interface CalendarMonthViewProps {
    currentDate: Date
    filteredAbsences: CoachAbsence[]
    trainings: Training[]
    activeCoachId: string | null
    onSelectDate: (dateStr: string) => void
    onEditAbsence: (absence: CoachAbsence) => void
}

const formatDateLongGerman = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('de-AT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

export default function CalendarMonthView({
    currentDate,
    filteredAbsences,
    trainings,
    activeCoachId,
    onSelectDate,
    onEditAbsence
}: CalendarMonthViewProps) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()

    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const todayStr = new Date().toISOString().split('T')[0]
    const [selectedDate, setSelectedDate] = useState<string>(todayStr)

    const calendarCells: (string | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarCells.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0')
        const mStr = String(month + 1).padStart(2, '0')
        calendarCells.push(`${year}-${mStr}-${dStr}`)
    }

    // Details für den aktuell ausgewählten Tag
    const selectedDayTrainings = trainings.filter(t => t.date === selectedDate)
    const selectedDayAbsences = filteredAbsences.filter(a => isCoachAbsentOnDate(a, selectedDate))

    return (
        <div className="space-y-4">
            {/* Kalender Monatsraster */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
                                <div key={`empty-${index}`} className="min-h-[72px] sm:min-h-[96px] bg-gray-50/30" />
                            )
                        }

                        const isToday = dateStr === todayStr
                        const isSelected = dateStr === selectedDate
                        const cellDayNumber = parseInt(dateStr.split('-')[2], 10)
                        const dayOfWeek = getDayOfWeekFromDateString(dateStr)
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                        // Abwesenheiten und Trainings an diesem Tag
                        const dayAbsences = filteredAbsences.filter(a => isCoachAbsentOnDate(a, dateStr))
                        const dayTrainings = trainings.filter(t => t.date === dateStr)
                        const totalEvents = dayAbsences.length + dayTrainings.length

                        return (
                            <button
                                key={dateStr}
                                type="button"
                                onClick={() => setSelectedDate(dateStr)}
                                className={`min-h-[72px] sm:min-h-[96px] p-1 sm:p-2 flex flex-col justify-between transition cursor-pointer text-left focus:outline-none ${
                                    isSelected
                                        ? 'bg-blue-50/90 ring-2 ring-blue-600 ring-inset z-10'
                                        : isToday
                                        ? 'bg-blue-50/40 font-semibold'
                                        : isWeekend
                                        ? 'bg-amber-50/20 hover:bg-gray-50'
                                        : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span
                                        className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${
                                            isToday
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : isSelected
                                                ? 'text-blue-700 font-extrabold'
                                                : 'text-gray-700'
                                        }`}
                                    >
                                        {cellDayNumber}
                                    </span>

                                    {totalEvents > 0 && (
                                        <span className="text-[10px] text-gray-400 font-medium sm:hidden">
                                            {totalEvents}
                                        </span>
                                    )}
                                </div>

                                {/* Event-Indikatoren */}
                                <div className="mt-1 space-y-1 w-full overflow-hidden">
                                    {/* Mobile: Farbige Indikator-Punkte */}
                                    <div className="flex sm:hidden items-center gap-1">
                                        {dayTrainings.length > 0 && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Training" />
                                        )}
                                        {dayAbsences.map(a => (
                                            <span
                                                key={a.id}
                                                className="w-2 h-2 rounded-full bg-purple-500 inline-block"
                                                title={a.coaches?.name || 'Trainer abwesend'}
                                            />
                                        ))}
                                    </div>

                                    {/* Tablet & Desktop: Badges */}
                                    <div className="hidden sm:block space-y-1">
                                        {dayTrainings.map(t => (
                                            <div
                                                key={t.id}
                                                className="text-[11px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1"
                                            >
                                                <span>🏸</span>
                                                <span className="truncate">{t.description || 'Training'}</span>
                                            </div>
                                        ))}

                                        {dayAbsences.slice(0, 2).map(a => {
                                            const coachName = a.coaches?.name || 'Trainer'
                                            const isOwn = a.coach_id === activeCoachId
                                            const theme = getAbsenceTheme(a)

                                            return (
                                                <div
                                                    key={a.id}
                                                    className={`text-[11px] px-1.5 py-0.5 rounded font-medium truncate flex items-center gap-1 border ${theme.bgClass} ${theme.textClass} ${theme.borderClass} ${isOwn ? 'ring-1 ring-blue-500 font-bold' : ''}`}
                                                >
                                                    <span>{theme.icon}</span>
                                                    <span className="truncate">{coachName}</span>
                                                </div>
                                            )
                                        })}

                                        {dayAbsences.length > 2 && (
                                            <div className="text-[10px] text-gray-500 font-medium px-1">
                                                +{dayAbsences.length - 2} weitere
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Detail-Ansicht des ausgewählten Tages (Agenda / Übersicht) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span>📅</span>
                            <span>{formatDateLongGerman(selectedDate)}</span>
                            {selectedDate === todayStr && (
                                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                    Heute
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {selectedDayTrainings.length} Training(s) geplant • {selectedDayAbsences.length} Trainer abwesend
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => onSelectDate(selectedDate)}
                        className="self-start sm:self-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer min-h-[38px]"
                    >
                        <PlusIcon size={16} />
                        <span>Abwesenheit für diesen Tag</span>
                    </button>
                </div>

                <div className="mt-3 space-y-2.5">
                    {/* Geplante Trainings */}
                    {selectedDayTrainings.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                Trainings
                            </p>
                            <div className="space-y-1.5">
                                {selectedDayTrainings.map(t => (
                                    <div
                                        key={t.id}
                                        className="bg-green-50 border border-green-200 text-green-900 px-3.5 py-2.5 rounded-xl flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-lg">🏸</span>
                                            <div>
                                                <p className="font-bold text-sm">
                                                    {t.description || 'Reguläres Vereinstraining'}
                                                </p>
                                                <p className="text-xs text-green-700">
                                                    Trainingseinheit in der Halle
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Abwesenheiten der Trainer */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                            Trainer-Abwesenheiten ({selectedDayAbsences.length})
                        </p>
                        {selectedDayAbsences.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-1">
                                Keine Trainer für diesen Tag als abwesend gemeldet. Alle Trainer verfügbar.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedDayAbsences.map(a => {
                                    const coachName = a.coaches?.name || 'Trainer'
                                    const theme = getAbsenceTheme(a)
                                    const cleanReason = cleanReasonText(a.reason)
                                    const isOwn = a.coach_id === activeCoachId

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => onEditAbsence(a)}
                                            className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer hover:opacity-90 ${theme.bgClass} ${theme.borderClass}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xl">{theme.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-gray-800">
                                                            {coachName}
                                                        </span>
                                                        {isOwn && (
                                                            <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                                                                Du
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-xs ${theme.textClass} font-medium`}>
                                                        {cleanReason || 'Abwesend'}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEditAbsence(a)
                                                }}
                                                className="p-2 text-gray-500 hover:text-blue-600 rounded-lg transition"
                                                title="Bearbeiten"
                                            >
                                                <EditIcon size={16} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
