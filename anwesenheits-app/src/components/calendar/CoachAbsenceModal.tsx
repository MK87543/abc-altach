import type { Coach, AbsenceType } from '../../types/interfaces'
import { CheckIcon, XIcon, SpinnerIcon } from '../Icons'
import {
    GERMAN_WEEKDAYS,
    GERMAN_WEEKDAYS_SHORT,
    getAbsenceIcon
} from '../../lib/absenceUtils'

export const REASON_TILES = [
    { label: 'Urlaub', icon: '🏖️', value: 'Urlaub' },
    { label: 'Krank', icon: '🩹', value: 'Krank' },
    { label: 'Beruflich', icon: '💼', value: 'Beruflich' },
    { label: 'Schule / Uni', icon: '🎓', value: 'Schule / Uni' },
    { label: 'Privat', icon: '🏠', value: 'Privat' },
    { label: 'Termin', icon: '🗓️', value: 'Termin' },
]

interface CoachAbsenceModalProps {
    isOpen: boolean
    onClose: () => void
    editingAbsenceId: string | null
    absenceMode: 'single' | 'range' | 'weekly'
    setAbsenceMode: (mode: 'single' | 'range' | 'weekly') => void
    selectedCoachId: string
    setSelectedCoachId: (id: string) => void
    startDate: string
    setStartDate: (date: string) => void
    endDate: string
    setEndDate: (date: string) => void
    recurringDays: number[]
    toggleRecurringDay: (dayIdx: number) => void
    recurrenceInterval: number
    setRecurrenceInterval: (interval: number) => void
    selectedReasonChip: string
    setSelectedReasonChip: (chip: string) => void
    customDetail: string
    setCustomDetail: (detail: string) => void
    saving: boolean
    onSave: () => void
    coaches: Coach[]
}

export default function CoachAbsenceModal({
    isOpen,
    onClose,
    editingAbsenceId,
    absenceMode,
    setAbsenceMode,
    selectedCoachId,
    setSelectedCoachId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    recurringDays,
    toggleRecurringDay,
    recurrenceInterval,
    setRecurrenceInterval,
    selectedReasonChip,
    setSelectedReasonChip,
    customDetail,
    setCustomDetail,
    saving,
    onSave,
    coaches
}: CoachAbsenceModalProps) {
    if (!isOpen) return null

    const effectiveAbsenceType: AbsenceType = absenceMode === 'weekly'
        ? 'recurring'
        : (absenceMode === 'range' ? 'range' : 'single')
    const activeModalIcon = getAbsenceIcon({ absence_type: effectiveAbsenceType, reason: selectedReasonChip })
    const coachObj = coaches.find(c => c.id === selectedCoachId)

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] overflow-y-auto">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150">
                {/* Mobile Pull-Bar Indicator */}
                <div className="pt-2 pb-0.5 flex justify-center sm:hidden">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Modal Header: Hell, freundlich, übersichtlich */}
                <div className="flex items-center justify-between px-5 pt-3 pb-3.5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
                            {activeModalIcon}
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 leading-tight">
                                {editingAbsenceId ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">
                                {coachObj ? coachObj.name : 'Trainer auswählen'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Schließen"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                {/* Modal Body: Luftig & fokussiert ohne Scroll-Zwang */}
                <div className="p-4 sm:p-5 space-y-3 sm:space-y-3.5 overflow-y-auto flex-1">
                    {/* 1. Modus-Umschalter: 3 intuitive Optionen */}
                    <div>
                        <div className="grid grid-cols-3 p-1 bg-gray-100 rounded-xl text-xs font-semibold text-gray-600 gap-1">
                            <button
                                type="button"
                                onClick={() => setAbsenceMode('single')}
                                className={`py-2 px-1 rounded-lg transition min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
                                    absenceMode === 'single'
                                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                                        : 'hover:text-gray-900'
                                }`}
                            >
                                <span>📅</span>
                                <span>Einzeltag</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAbsenceMode('range')
                                    if (!endDate) setEndDate(startDate)
                                }}
                                className={`py-2 px-1 rounded-lg transition min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
                                    absenceMode === 'range'
                                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                                        : 'hover:text-gray-900'
                                }`}
                            >
                                <span>🏖️</span>
                                <span>Zeitraum</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAbsenceMode('weekly')}
                                className={`py-2 px-1 rounded-lg transition min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
                                    absenceMode === 'weekly'
                                        ? 'bg-white text-blue-600 shadow-xs font-bold'
                                        : 'hover:text-gray-900'
                                }`}
                            >
                                <span>🔄</span>
                                <span>Wöchentlich</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. Trainer auswählen */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Trainer *
                        </label>
                        <select
                            value={selectedCoachId}
                            onChange={(e) => setSelectedCoachId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition cursor-pointer min-h-[44px]"
                        >
                            <option value="" disabled>-- Trainer auswählen --</option>
                            {coaches.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.role ? `(${c.role})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Zeit / Datum je nach Modus */}
                    {absenceMode === 'single' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                Datum *
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[44px]"
                            />
                        </div>
                    )}

                    {absenceMode === 'range' && (
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Von *
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value)
                                        if (endDate && endDate < e.target.value) {
                                            setEndDate(e.target.value)
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[44px]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Bis *
                                </label>
                                <input
                                    type="date"
                                    value={endDate || startDate}
                                    min={startDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[44px]"
                                />
                            </div>
                        </div>
                    )}

                    {absenceMode === 'weekly' && (
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-gray-700">
                                        Wochentage *
                                    </label>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {recurringDays.length} {recurringDays.length === 1 ? 'Tag' : 'Tage'} ausgewählt
                                    </span>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                        const isSelected = recurringDays.includes(dayIdx)
                                        return (
                                            <button
                                                key={dayIdx}
                                                type="button"
                                                onClick={() => toggleRecurringDay(dayIdx)}
                                                className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center min-h-[40px] ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                                }`}
                                                title={GERMAN_WEEKDAYS[dayIdx]}
                                            >
                                                <span>{GERMAN_WEEKDAYS_SHORT[dayIdx]}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Gültig ab
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[42px]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Wiederholung
                                    </label>
                                    <select
                                        value={recurrenceInterval}
                                        onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition cursor-pointer min-h-[42px]"
                                    >
                                        <option value={1}>Jede Woche</option>
                                        <option value={2}>Alle 2 Wochen</option>
                                        <option value={3}>Alle 3 Wochen</option>
                                        <option value={4}>Alle 4 Wochen</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Grund der Abwesenheit: Schnelle Chips + optionale Notiz */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Grund
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {REASON_TILES.map(tile => {
                                const isSelected = selectedReasonChip === tile.value
                                return (
                                    <button
                                        key={tile.value}
                                        type="button"
                                        onClick={() => setSelectedReasonChip(tile.value)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                    >
                                        <span>{tile.icon}</span>
                                        <span>{tile.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <input
                            type="text"
                            value={customDetail}
                            onChange={(e) => setCustomDetail(e.target.value)}
                            placeholder="Optionale Notiz (z. B. Prüfung, Lehrgang)..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[40px]"
                        />
                    </div>
                </div>

                {/* Modal Footer: Sauber fixiert mit Safe-Area Inset */}
                <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition cursor-pointer min-h-[44px]"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
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
}
