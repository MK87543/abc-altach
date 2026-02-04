import { useState } from 'react'
import EditPlayers from './EditPlayers'
import EditCoaches from './EditCoaches'
import { EditIcon, UserIcon, CoachIcon } from '../components/Icons'

interface ManageEditProps {
    onBack: () => void
}

type Tab = 'player' | 'coach'

export default function ManageEdit({ onBack }: ManageEditProps) {
    const [activeTab, setActiveTab] = useState<Tab>('player')

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <EditIcon size={32} />
                        Daten bearbeiten
                    </h1>
                    <button
                        onClick={onBack}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                    >
                        Zurück
                    </button>
                </div>

                <div className="flex p-1 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => setActiveTab('player')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition font-medium ${activeTab === 'player'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <UserIcon size={18} />
                        Spieler
                    </button>
                    <button
                        onClick={() => setActiveTab('coach')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition font-medium ${activeTab === 'coach'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <CoachIcon size={18} />
                        Trainer
                    </button>
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                {activeTab === 'player' ? (
                    <EditPlayers onBack={onBack} hideHeader={true} />
                ) : (
                    <EditCoaches onBack={onBack} hideHeader={true} />
                )}
            </div>
        </div>
    )
}
