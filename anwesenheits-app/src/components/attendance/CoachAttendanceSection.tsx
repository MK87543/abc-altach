import React from 'react'
import type { Coach } from '../../types/interfaces'
import { WarningIcon } from '../Icons'

interface CoachAttendanceSectionProps {
    coaches: Coach[]
    selectedMandatoryCoaches: Set<string>
    selectedAdditionalCoaches: Set<string>
    onToggleMandatory: (coachId: string) => void
    onToggleAdditional: (coachId: string) => void
}

export const CoachAttendanceSection: React.FC<CoachAttendanceSectionProps> = ({
    coaches,
    selectedMandatoryCoaches,
    selectedAdditionalCoaches,
    onToggleMandatory,
    onToggleAdditional,
}) => {
    const totalCoachesSelected = selectedMandatoryCoaches.size + selectedAdditionalCoaches.size

    return (
        <details
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md mb-5 group"
            open={totalCoachesSelected > 0}
        >
            <summary className="p-5 cursor-pointer flex items-center justify-between list-none">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    Trainer auswählen
                    {totalCoachesSelected > 0 && (
                        <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            {totalCoachesSelected} gewählt
                        </span>
                    )}
                </h2>
                <span className="text-gray-400 text-sm transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="px-5 pb-5 space-y-5">
                {/* Pflichttrainer */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700 font-medium text-base">Pflichttrainer</span>
                        <span
                            className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                                selectedMandatoryCoaches.size >= 2
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-blue-100 text-blue-700'
                            }`}
                        >
                            {selectedMandatoryCoaches.size}/2
                        </span>
                    </div>
                    <div className="space-y-2">
                        {coaches.length === 0 ? (
                            <p className="text-gray-500 text-sm py-1">Keine Trainer gefunden</p>
                        ) : (
                            coaches.map(coach => {
                                const isSelected = selectedMandatoryCoaches.has(coach.id)
                                const isAlreadyAdditional = selectedAdditionalCoaches.has(coach.id)
                                const isDisabled = isAlreadyAdditional || (!isSelected && selectedMandatoryCoaches.size >= 2)
                                return (
                                    <label
                                        key={coach.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition min-h-[48px] ${
                                            isAlreadyAdditional
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border border-gray-200'
                                                : isDisabled
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border border-gray-200'
                                                : isSelected
                                                ? 'bg-blue-50 border-2 border-blue-400 cursor-pointer'
                                                : 'bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onChange={() => onToggleMandatory(coach.id)}
                                            className="w-6 h-6 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-gray-800 flex-1 text-base">
                                            {coach.name}
                                            {coach.role && (
                                                <span className="text-sm text-gray-500 ml-2">({coach.role})</span>
                                            )}
                                        </span>
                                        {isSelected && (
                                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                                Pflicht
                                            </span>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                    {selectedMandatoryCoaches.size >= 2 && (
                        <p className="text-orange-600 text-sm mt-1 flex items-center gap-1">
                            <WarningIcon size={14} />
                            Maximale Anzahl von 2 Pflichttrainern erreicht
                        </p>
                    )}
                </div>

                {/* Zusatztrainer */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700 font-medium text-base">Zusatztrainer</span>
                        {selectedAdditionalCoaches.size > 0 && (
                            <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                {selectedAdditionalCoaches.size} ausgewählt
                            </span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {coaches.length === 0 ? (
                            <p className="text-gray-500 text-sm py-1">Keine Trainer gefunden</p>
                        ) : (
                            coaches.map(coach => {
                                const isSelected = selectedAdditionalCoaches.has(coach.id)
                                const isAlreadyMandatory = selectedMandatoryCoaches.has(coach.id)
                                return (
                                    <label
                                        key={coach.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition min-h-[48px] ${
                                            isAlreadyMandatory
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 border border-gray-200'
                                                : isSelected
                                                ? 'bg-green-50 border-2 border-green-400 cursor-pointer'
                                                : 'bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isAlreadyMandatory}
                                            onChange={() => onToggleAdditional(coach.id)}
                                            className="w-6 h-6 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-gray-800 flex-1 text-base">
                                            {coach.name}
                                            {coach.role && (
                                                <span className="text-sm text-gray-500 ml-2">({coach.role})</span>
                                            )}
                                        </span>
                                        {isSelected && (
                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                Zusatz
                                            </span>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </details>
    )
}
