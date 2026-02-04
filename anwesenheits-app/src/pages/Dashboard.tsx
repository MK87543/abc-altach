import { useState } from 'react'
import { supabase } from '../lib/supabase'
import NewAttendance from './NewAttendance'
import AttendanceHistory from './AttendanceHistory'
import TrainingPlanner from './TrainingPlanner'
import ExportAttendance from './ExportAttendance'
import Statistics from './Statistics'
import ManageNew from './ManageNew'
import ManageEdit from './ManageEdit'
import { MenuIcon, FileTextIcon, ClipboardIcon, CalendarIcon, EditIcon, LogoutIcon, DownloadIcon, ChartIcon, PlusIcon } from '../components/Icons'

type View = 'attendance' | 'history' | 'planner' | 'export' | 'statistics' | 'manageNew' | 'manageEdit'

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
                        className="fixed inset-0 z-[9998]"
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
                                <MenuIcon size={24} />
                                Menü
                            </button>
                        </div>
                    </div>
                )}

                {/* Dropdown Menu - positioned absolutely to viewport */}
                {isMenuOpen && (
                    <div
                        className="fixed top-32 right-8 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 z-[9999]"
                        style={{ maxWidth: 'calc(100vw - 2rem)' }}
                    >
                        <div className="py-2">
                            {currentView !== 'attendance' && (
                                <button
                                    onClick={() => navigateTo('attendance')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <FileTextIcon />
                                    <span>Neue Anwesenheit</span>
                                </button>
                            )}
                            {currentView !== 'history' && (
                                <button
                                    onClick={() => navigateTo('history')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <ClipboardIcon />
                                    <span>Historie</span>
                                </button>
                            )}
                            {currentView !== 'planner' && (
                                <button
                                    onClick={() => navigateTo('planner')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <CalendarIcon />
                                    <span>Trainings planen</span>
                                </button>
                            )}
                            {currentView !== 'export' && (
                                <button
                                    onClick={() => navigateTo('export')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <DownloadIcon />
                                    <span>Excel Export</span>
                                </button>
                            )}
                            {currentView !== 'statistics' && (
                                <button
                                    onClick={() => navigateTo('statistics')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <ChartIcon />
                                    <span>Statistik</span>
                                </button>
                            )}
                            <div className="border-t border-gray-200 my-2"></div>
                            {currentView !== 'manageNew' && (
                                <button
                                    onClick={() => navigateTo('manageNew')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <PlusIcon />
                                    <span>Neu erstellen</span>
                                </button>
                            )}
                            {currentView !== 'manageEdit' && (
                                <button
                                    onClick={() => navigateTo('manageEdit')}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition flex items-center gap-3"
                                >
                                    <EditIcon />
                                    <span>Daten bearbeiten</span>
                                </button>
                            )}
                            <div className="border-t border-gray-200 my-2"></div>
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 transition flex items-center gap-3"
                            >
                                <LogoutIcon />
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
                {currentView === 'planner' && (
                    <TrainingPlanner onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'export' && (
                    <ExportAttendance onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'statistics' && (
                    <Statistics onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'manageNew' && (
                    <ManageNew onBack={() => navigateTo('attendance')} />
                )}
                {currentView === 'manageEdit' && (
                    <ManageEdit onBack={() => navigateTo('attendance')} />
                )}
            </div>
        </div>
    )
}
