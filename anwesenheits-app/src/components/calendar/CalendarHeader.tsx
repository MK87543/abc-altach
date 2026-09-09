import type { Coach } from '../../types/interfaces'
import type { CalendarViewMode } from '../../hooks/useCoachCalendar'
import {
    CalendarIcon,
    PlusIcon,
    UmbrellaIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserIcon
} from '../Icons'
import { GERMAN_MONTHS } from '../../lib/absenceUtils'

interface CalendarHeaderProps {
    hideHeader?: boolean
    onBack?: () => void
    onNewAbsence: () => void
    activeCoachId: string | null
    setActiveCoach: (id: string | null) => void
    coaches: Coach[]
    filterCoachId: string
    setFilterCoachId: (id: string) => void
    prevMonth: () => void
    nextMonth: () => void
    goToToday: () => void
    currentDate: Date
    viewMode: CalendarViewMode
    setViewMode: (mode: CalendarViewMode) => void
    filteredCount: number
    onSelectMonthYear?: (year: number, monthZeroIndexed: number) => void
}

export default function CalendarHeader({
    hideHeader,
    onBack,
    onNewAbsence,
    activeCoachId,
    setActiveCoach,
    coaches,
    filterCoachId,
    setFilterCoachId,
    prevMonth,
    nextMonth,
    goToToday,
    currentDate,
    viewMode,
    setViewMode,
    filteredCount,
    onSelectMonthYear
}: CalendarHeaderProps) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    return (
        <>
            {/* ── Kopfbereich & Trainer-Cookie-Schnellwahl ── */}
            {hideHeader ? (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                            <UmbrellaIcon size={20} />
                        </span>
                        <div>
                            <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                                Trainer-Abwesenheiten
                            </h2>
                            <p className="text-xs text-slate-500">
                                Urlaub, Ausfälle & wöchentliche Verhinderungen
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onNewAbsence}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xs transition cursor-pointer shrink-0"
                    >
                        <PlusIcon size={18} />
                        <span>Abwesenheit eintragen</span>
                    </button>
                </div>
            ) : (
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
                                onClick={onNewAbsence}
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
            )}

            {/* ── Kalender-Navigation & Ansichtsumschalter in einer sauberen, zusammenhängenden Card ── */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-3 sm:p-4 mb-4 space-y-3">
                {/* 1. Obere Zeile: < Monat Jahr ▼ > als zusammenhängende Einheit + Heute-Button */}
                <div className="flex items-center justify-between gap-2">
                    {/* Monats-Navigation: Chevrons umschließen den Monatsnamen direkt */}
                    <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-2xs shrink-0"
                            title="Vorheriger Monat"
                            aria-label="Vorheriger Monat"
                        >
                            <ChevronLeftIcon size={18} />
                        </button>

                        {/* Monatsanzeige mit integriertem Kalender-Wähler */}
                        <label
                            className="relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-bold rounded-lg cursor-pointer shadow-xs transition select-none whitespace-nowrap"
                            title="Monat & Jahr direkt im Kalender auswählen"
                        >
                            <CalendarIcon size={14} className="text-blue-600 shrink-0" />
                            <span className="whitespace-nowrap">{GERMAN_MONTHS[month]} {year}</span>
                            <span className="text-slate-400 text-[10px] ml-0.5 shrink-0">▼</span>
                            <input
                                type="month"
                                value={`${year}-${String(month + 1).padStart(2, '0')}`}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const [y, m] = e.target.value.split('-').map(Number)
                                        if (onSelectMonthYear) {
                                            onSelectMonthYear(y, m - 1)
                                        }
                                    }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={nextMonth}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-2xs shrink-0"
                            title="Nächster Monat"
                            aria-label="Nächster Monat"
                        >
                            <ChevronRightIcon size={18} />
                        </button>
                    </div>

                    {/* Heute-Schnellwahl */}
                    <button
                        type="button"
                        onClick={goToToday}
                        className="px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer shadow-2xs shrink-0"
                    >
                        Heute
                    </button>
                </div>

                {/* 2. Untere Zeile: Ansichtsmodus (Monat / Woche / Liste) & Trainer-Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                    {/* Ansichtsmodus Segmented Switch */}
                    <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl text-xs font-semibold w-full sm:w-auto shadow-2xs gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('month')}
                            className={`py-2 px-3.5 rounded-lg transition cursor-pointer flex items-center justify-center text-center ${
                                viewMode === 'month'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Monat
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('week')}
                            className={`py-2 px-3.5 rounded-lg transition cursor-pointer flex items-center justify-center text-center ${
                                viewMode === 'week'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Woche
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`py-2 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center text-center truncate ${
                                viewMode === 'list'
                                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span className="truncate">Liste ({filteredCount})</span>
                        </button>
                    </div>

                    {/* Trainer-Filter (immer schnell zur Hand) */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs justify-between sm:justify-start">
                        <span className="text-slate-500 font-medium">Filter:</span>
                        <select
                            value={filterCoachId}
                            onChange={(e) => setFilterCoachId(e.target.value)}
                            className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                        >
                            <option value="all">Alle Trainer</option>
                            {coaches.map(coach => (
                                <option key={coach.id} value={coach.id}>
                                    Nur {coach.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </>
    )
}
