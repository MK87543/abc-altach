import EditPlayers from './EditPlayers'
import EditCoaches from './EditCoaches'
import { EditIcon, UserIcon, CoachIcon, ChevronLeftIcon } from '../components/Icons'
import { useUrlQueryParam } from '../lib/urlUtils'

interface ManageEditProps {
    onBack: () => void
}

type Tab = 'player' | 'coach'

export default function ManageEdit({ onBack }: ManageEditProps) {
    const [activeTab, setActiveTab] = useUrlQueryParam<Tab>('editTab', 'player')


    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-5">
                <div className="flex justify-between items-center mb-5">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <EditIcon size={28} />
                        Daten bearbeiten
                    </h1>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-xl transition text-sm font-medium cursor-pointer hover:bg-slate-100 min-h-[44px]"
                    >
                        <ChevronLeftIcon size={18} />
                        Zurück
                    </button>
                </div>

                <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('player')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition font-medium min-h-[44px] cursor-pointer ${activeTab === 'player'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <UserIcon size={18} />
                        Spieler
                    </button>
                    <button
                        onClick={() => setActiveTab('coach')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition font-medium min-h-[44px] cursor-pointer ${activeTab === 'coach'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <CoachIcon size={18} />
                        Trainer
                    </button>
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5">
                {activeTab === 'player' ? (
                    <EditPlayers onBack={onBack} hideHeader={true} />
                ) : (
                    <EditCoaches onBack={onBack} hideHeader={true} />
                )}
            </div>
        </div>
    )
}
