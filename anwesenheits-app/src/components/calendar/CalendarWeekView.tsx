import type { CoachAbsence, Training } from '../../types/interfaces'
import { PlusIcon } from '../Icons'
import {
    GERMAN_WEEKDAYS,
    formatDateShortGerman,
    isCoachAbsentOnDate,
    getAbsenceTheme,
    cleanReasonText
} from '../../lib/absenceUtils'

interface CalendarWeekViewProps {
    currentDate: Date
    filteredAbsences: CoachAbsence[]
    trainings: Training[]
    activeCoachId: string | null
    onSelectDate: (dateStr: string) => void
    onEditAbsence: (absence: CoachAbsence) => void
}

export default function CalendarWeekView({
    currentDate,
    filteredAbsences,
    trainings,
    activeCoachId,
    onSelectDate,
    onEditAbsence
}: CalendarWeekViewProps) {
    const todayStr = new Date().toISOString().split('T')[0]

    return (
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
                            className={`rounded-xl border p-3 min-h-[160px] flex flex-col justify-between ${
                                isToday ? 'bg-blue-50/60 border-blue-400' : 'bg-gray-50/60 border-gray-200'
                            }`}
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
                                                onClick={() => onEditAbsence(a)}
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
                                onClick={() => onSelectDate(dateKey)}
                                className="mt-3 w-full py-1 text-xs text-blue-600 hover:bg-blue-100/50 rounded transition font-medium flex items-center justify-center gap-1"
                            >
                                <PlusIcon size={14} /> Eintragen
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
