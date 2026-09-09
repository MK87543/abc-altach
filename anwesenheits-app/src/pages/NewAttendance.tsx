import { CheckIcon, WarningIcon, SaveIcon, LightbulbIcon, EditIcon, ClipboardIcon, SpinnerIcon, PlusIcon } from '../components/Icons'
import { useNewAttendance } from '../hooks/useNewAttendance'
import { CoachAttendanceSection } from '../components/attendance/CoachAttendanceSection'
import { PlayerAttendanceSection } from '../components/attendance/PlayerAttendanceSection'

interface NewAttendanceProps {
    onSuccess?: () => void
}

const formatDateGerman = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('de-AT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

export default function NewAttendance({ onSuccess }: NewAttendanceProps) {
    const {
        todaysTraining,
        players,
        coaches,
        selectedPlayers,
        selectedMandatoryCoaches,
        selectedAdditionalCoaches,
        description,
        setDescription,
        loading,
        saving,
        spontaneousLoading,
        isEditing,
        toggleMandatoryCoach,
        toggleAdditionalCoach,
        togglePlayer,
        selectAll,
        deselectAll,
        createSpontaneousTraining,
        saveAttendance,
    } = useNewAttendance({ onSuccess })

    if (loading) {
        return (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
                <SpinnerIcon size={32} className="text-blue-600" />
                <p className="text-gray-600 text-sm font-medium">Lade Training...</p>
            </div>
        )
    }

    // FALL 1: KEIN Training für heute geplant
    if (!todaysTraining) {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <div className="bg-yellow-50 border-2 border-yellow-400 text-yellow-900 p-6 rounded-lg text-center">
                    <div className="flex justify-center mb-3">
                        <WarningIcon className="text-yellow-600" size={48} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Kein Training geplant</h2>
                    <p className="mb-4">
                        Für heute ({new Date().toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long' })})
                        ist noch kein Training eingetragen.
                    </p>
                </div>

                {/* Notfall-Modus für spontanes Training */}
                <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                    <h3 className="text-gray-800 font-semibold mb-3">Spontanes Training erstellen?</h3>
                    <button
                        type="button"
                        onClick={createSpontaneousTraining}
                        disabled={spontaneousLoading}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {spontaneousLoading ? (
                            <>
                                <SpinnerIcon size={18} />
                                <span>Erstelle Training...</span>
                            </>
                        ) : (
                            <>
                                <PlusIcon size={18} />
                                <span>Jetzt schnell Training erstellen</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        )
    }

    // FALL 2: Training für heute existiert → Anwesenheit erfassen/bearbeiten
    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-10">
            {/* Header mit Training-Info */}
            <div className="bg-blue-50/60 border border-blue-200 p-5 rounded-xl mb-5">
                <div className="flex justify-between items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
                            {isEditing ? (
                                <><EditIcon size={22} /> Anwesenheit bearbeiten</>
                            ) : (
                                <><CheckIcon size={22} /> Anwesenheit erfassen</>
                            )}
                        </h1>
                        <p className="text-blue-800 text-sm sm:text-base">
                            {formatDateGerman(todaysTraining.date)}
                        </p>
                        {todaysTraining.description && (
                            <p className="text-blue-700 font-semibold mt-1.5 flex items-center gap-2 text-sm">
                                <ClipboardIcon size={15} />
                                {todaysTraining.description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={saveAttendance}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                        title="Sofort speichern"
                    >
                        <CheckIcon size={16} />
                        <span>Speichern</span>
                    </button>
                </div>
            </div>

            {/* Beschreibung bearbeiten */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-5">
                <label className="block text-gray-700 font-medium mb-2 text-base">
                    Beschreibung (optional)
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="z.B. Taktik, Techniktraining..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
            </div>

            {/* Trainer Auswahl */}
            <CoachAttendanceSection
                coaches={coaches}
                selectedMandatoryCoaches={selectedMandatoryCoaches}
                selectedAdditionalCoaches={selectedAdditionalCoaches}
                onToggleMandatory={toggleMandatoryCoach}
                onToggleAdditional={toggleAdditionalCoach}
            />

            {/* Spieler Auswahl */}
            <PlayerAttendanceSection
                players={players}
                selectedPlayers={selectedPlayers}
                onTogglePlayer={togglePlayer}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
            />

            {/* Info-Hinweis */}
            {isEditing && (
                <p className="text-gray-500 text-sm text-center my-3 flex items-center justify-center gap-2">
                    <LightbulbIcon size={16} />
                    Diese Anwesenheit wurde bereits erfasst und wird überschrieben
                </p>
            )}

            {/* Prominenter Speichern-Button im normalen Dokumentenfluss (keine Überlappung) */}
            <div className="mt-6 mb-12">
                <button
                    type="button"
                    onClick={saveAttendance}
                    disabled={saving}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer min-h-[56px]"
                >
                    {saving ? (
                        <>
                            <SpinnerIcon size={24} />
                            <span>Wird gespeichert...</span>
                        </>
                    ) : isEditing ? (
                        <>
                            <SaveIcon size={24} />
                            <span>Anwesenheit aktualisieren</span>
                        </>
                    ) : (
                        <>
                            <CheckIcon size={24} />
                            <span>Anwesenheit speichern</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
