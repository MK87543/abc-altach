import React from 'react'
import type { Player } from '../../types/interfaces'
import { CheckIcon, XIcon } from '../Icons'

interface PlayerAttendanceSectionProps {
    players: Player[]
    selectedPlayers: Set<string>
    onTogglePlayer: (playerId: string) => void
    onSelectAll: () => void
    onDeselectAll: () => void
}

export const PlayerAttendanceSection: React.FC<PlayerAttendanceSectionProps> = ({
    players,
    selectedPlayers,
    onTogglePlayer,
    onSelectAll,
    onDeselectAll,
}) => {
    return (
        <>
            {/* Schnell-Buttons */}
            <div className="flex gap-3 mb-4">
                <button
                    type="button"
                    onClick={onSelectAll}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl transition font-medium flex items-center justify-center gap-2 min-h-[48px] text-base cursor-pointer"
                >
                    <CheckIcon />
                    Alle markieren
                </button>
                <button
                    type="button"
                    onClick={onDeselectAll}
                    className="flex-1 border-2 border-gray-300 text-gray-600 hover:bg-gray-100 py-3 rounded-xl transition font-medium flex items-center justify-center gap-2 min-h-[48px] text-base cursor-pointer"
                >
                    <XIcon />
                    Alle abwählen
                </button>
            </div>

            {/* Spielerliste */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-5">
                <h2 className="text-base font-semibold text-gray-800 mb-4">
                    Anwesende Spieler ({selectedPlayers.size} von {players.length})
                </h2>

                <div className="space-y-2">
                    {players.length === 0 ? (
                        <p className="text-gray-500 text-sm py-2">Keine aktiven Spieler gefunden.</p>
                    ) : (
                        players.map(player => {
                            const isSelected = selectedPlayers.has(player.id)
                            return (
                                <label
                                    key={player.id}
                                    className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition min-h-[48px] ${
                                        isSelected
                                            ? 'bg-green-100 border-2 border-green-500'
                                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onTogglePlayer(player.id)}
                                        className="w-6 h-6 cursor-pointer"
                                    />
                                    <span className="text-gray-800 font-medium text-base flex-1">
                                        {player.name}
                                    </span>
                                    {isSelected && <CheckIcon className="text-green-600" size={24} />}
                                </label>
                            )
                        })
                    )}
                </div>
            </div>
        </>
    )
}
