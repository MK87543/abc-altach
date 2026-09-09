import type { CoachAbsence } from '../../types/interfaces'
import { RepeatIcon, UmbrellaIcon, EditIcon, TrashIcon } from '../Icons'
import {
    getAbsenceTheme,
    cleanReasonText,
    getAbsenceTypeBadge,
    formatRecurringSummary,
    formatDateGerman
} from '../../lib/absenceUtils'

interface CalendarListViewProps {
    filteredAbsences: CoachAbsence[]
    onEditAbsence: (absence: CoachAbsence) => void
    onDeleteAbsence: (id: string) => void
}

export default function CalendarListView({
    filteredAbsences,
    onEditAbsence,
    onDeleteAbsence
}: CalendarListViewProps) {
    const todayStr = new Date().toISOString().split('T')[0]

    const recurringAbsences = filteredAbsences.filter(a => a.absence_type === 'recurring')
    const nonRecurringAbsences = filteredAbsences
        .filter(a => a.absence_type !== 'recurring')
        .sort((a, b) => a.start_date.localeCompare(b.start_date))

    return (
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

                {recurringAbsences.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                        Keine wiederkehrenden Abwesenheiten eingetragen.
                    </p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {recurringAbsences.map(a => {
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
                                            onClick={() => onEditAbsence(a)}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                            title="Bearbeiten"
                                        >
                                            <EditIcon size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteAbsence(a.id)}
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

                {nonRecurringAbsences.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                        Keine Urlaube oder Einzeltage eingetragen.
                    </p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {nonRecurringAbsences.map(a => {
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
                                            onClick={() => onEditAbsence(a)}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                            title="Bearbeiten"
                                        >
                                            <EditIcon size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteAbsence(a.id)}
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
        </div>
    )
}
