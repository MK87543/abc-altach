import { useState } from 'react'
import { supabase } from '../lib/supabase'
import NewAttendance from './NewAttendance'
import AttendanceHistory from './AttendanceHistory'
import NewPlayer from './NewPlayer'
import NewCoach from './NewCoach'
import EditPlayers from './EditPlayers'
import EditCoaches from './EditCoaches'

type View = 'attendance' | 'history' | 'newPlayer' | 'newCoach' | 'editPlayers' | 'editCoaches'

export default function Dashboard() {
    const [currentView, setCurrentView] = useState<View>('attendance')
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
    }

    const navigateTo = (view: View) => {
        setCurrentView(view)
        setIsMenuOpen(false)
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Overlay to close menu when clicking outside */}
                {isMenuOpen && (
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsMenuOpen(false)}
                    />
                )}

                {/* Header - nur bei attendance view */}
                {currentView === 'attendance' && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6 relative">
                        <div className="flex justify-between items-center">
                            <h1 className="text-3xl font-bold text-gray-800">Trainings Anwesenheit</h1>

                            {/* Hamburger Menu Button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                            >
                                <span className="text-2xl">☰</span>
                                Menü
                            </button>
                        </div>
                    </div>
                )}

                {/* Dropdown Menu - positioned absolutely to viewport */}
                {isMenuOpen && (
                    <div
                        className="fixed top-32 right-8 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 z-[110]"
                        style={{ maxWidth: 'calc(100vw - 2rem)' }}
                    >
                        <div className="py-2">
                            {currentView !== 'attendance' && (
                                <button
                                    onClick={() => navigateTo('attendance')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>📝</span>
                                    <span>Neue Anwesenheit</span>
                                </button>
                            )}
                            {currentView !== 'history' && (
                                <button
                                    onClick={() => navigateTo('history')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>📋</span>
                                    <span>Historie</span>
                                </button>
                            )}
                            {currentView !== 'newPlayer' && (
                                <button
                                    onClick={() => navigateTo('newPlayer')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>👤</span>
                                    <span>Neuer Spieler</span>
                                </button>
                            )}
                            {currentView !== 'newCoach' && (
                                <button
                                    onClick={() => navigateTo('newCoach')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>👨‍🏫</span>
                                    <span>Neuer Trainer</span>
                                </button>
                            )}
                            <div className="border-t border-gray-200 my-2"></div>
                            {currentView !== 'editPlayers' && (
                                <button
                                    onClick={() => navigateTo('editPlayers')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>✏️</span>
                                    <span>Spieler bearbeiten</span>
                                </button>
                            )}
                            {currentView !== 'editCoaches' && (
                                <button
                                    onClick={() => navigateTo('editCoaches')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <span>📝</span>
                                    <span>Trainer bearbeiten</span>
                                </button>
                            )}
                            <div className="border-t border-gray-200 my-2"></div>
                            <div className="border-t border-gray-200 my-2"></div>
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 transition flex items-center gap-3"
                            >
                                <span>🚪</span>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                {currentView === 'attendance' && (
                    <NewAttendance onSuccess={() => {
                        // Optional: Könnte automatisch zur Historie wechseln
                        // navigateTo('history')
                    }} />
                )}
                {currentView === 'history' && (
                    <AttendanceHistory onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'newCoach' && (
                    <NewCoach
                        onBack={() => navigateTo('attendance')}
                        onSuccess={() => {
                            // Trainer wurde erstellt
                        }}
                    />
                )}
                {currentView === 'newPlayer' && (
                    <NewPlayer
                        onBack={() => navigateTo('attendance')}
                        onSuccess={() => {
                            // Spieler wurde erstellt
                        }}
                    />
                )}
                {currentView === 'editPlayers' && (
                    <EditPlayers onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'editCoaches' && (
                    <EditCoaches onBack={() => navigateTo('attendance')} />
                )}
            </div>
        </div>
    )
}
