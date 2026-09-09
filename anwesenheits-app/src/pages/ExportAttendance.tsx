import { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as ExcelJS from 'exceljs'
import type { Attendance, Coach, CoachAttendance, Player, Training } from '../types/interfaces'
import { useToast } from '../components/Toast'
import { useUrlQueryParam } from '../lib/urlUtils'
import { SpinnerIcon } from '../components/Icons'

interface ExportAttendanceProps {
    onBack?: () => void
}

type TrainingWithAttendance = Training & {
    attendance?: Array<Pick<Attendance, 'player_id' | 'is_present'>>
    coach_attendance?: Array<Pick<CoachAttendance, 'is_present'> & { coaches?: Pick<Coach, 'name'> | null }>
}

type NavigatorWithMsSaveBlob = Navigator & {
    msSaveBlob?: (blob: Blob, filename?: string) => void
}

export default function ExportAttendance({ onBack }: ExportAttendanceProps) {
    const { toast } = useToast()
    const [startDate, setStartDate] = useUrlQueryParam<string>('exportFrom', '')
    const [endDate, setEndDate] = useUrlQueryParam<string>('exportTo', '')
    const [loading, setLoading] = useState(false)

    async function exportToExcel() {
        if (!startDate || !endDate) {
            toast.warning('Bitte Start- und Enddatum auswählen.')
            return
        }


        setLoading(true)
        console.log('DEBUG: Export gestartet...')

        try {
            // 1. Lade alle aktiven Spieler und Trainings parallel
            const [playersResponse, trainingsResponse] = await Promise.all([
                supabase
                    .from('players')
                    .select('id, name')
                    .eq('active', true)
                    .order('name'),
                supabase
                    .from('trainings')
                    .select(`
                        *,
                        attendance (
                            player_id,
                            is_present
                        ),
                        coach_attendance (
                            coach_id,
                            is_present,
                            coaches ( name )
                        )
                    `)
                    .gte('date', startDate)
                    .lte('date', endDate)
                    .order('date', { ascending: true })
            ])

            if (playersResponse.error) throw playersResponse.error
            if (trainingsResponse.error) throw trainingsResponse.error

            const players = (playersResponse.data || []) as Array<Pick<Player, 'id' | 'name'>>
            const trainings = (trainingsResponse.data || []) as TrainingWithAttendance[]

            if (trainings.length === 0) {
                toast.info('Keine Trainings im ausgewählten Zeitraum gefunden.')
                setLoading(false)
                return
            }

            // --- BLATT 1: ANWESENHEITSLISTE ---
            const attendanceData: Array<Array<string | number>> = []

            // Titel und Metadaten
            attendanceData.push(['ANWESENHEITSLISTE ABC ALTACH'])
            attendanceData.push([`Zeitraum: ${new Date(startDate).toLocaleDateString('de-AT')} bis ${new Date(endDate).toLocaleDateString('de-AT')}`])
            attendanceData.push(['']) // Leere Zeile

            // Header
            const playerNames = players.map(p => p.name)
            const headers = ['Datum', 'Wochentag', 'Beschreibung', 'Trainer', ...playerNames]
            attendanceData.push(headers)

            // Datenzeilen
            trainings.forEach(training => {
                const dateObj = new Date(training.date)
                const dateStr = dateObj.toLocaleDateString('de-AT')
                const weekday = dateObj.toLocaleDateString('de-AT', { weekday: 'long' })
                const description = training.description || '-'

                const coaches = training.coach_attendance
                    ?.filter((ca) => ca.is_present && ca.coaches?.name)
                    .map((ca) => ca.coaches?.name)
                    .filter((name): name is string => Boolean(name))
                    .join(', ') || '-'

                const row: Array<string | number> = [dateStr, weekday, description, coaches]

                // Checkmarks für jeden Spieler
                players.forEach(player => {
                    const isPresent = training.attendance?.some(
                        (att) => att.player_id === player.id && att.is_present
                    )
                    row.push(isPresent ? 'X' : '')
                })

                attendanceData.push(row)
            })

            // --- BLATT 2: STATISTIK ---
            const statsData: Array<Array<string | number>> = []
            statsData.push(['TRAININGS-STATISTIK'])
            statsData.push([`Gesamtanzahl Trainings: ${trainings.length}`])
            statsData.push([''])
            statsData.push(['Name', 'Anwesend', 'Quote (%)'])

            // Statistik berechnen
            const stats = players.map(player => {
                const attendedCount = trainings.reduce((count, training) => {
                    const isPresent = training.attendance?.some(
                        (att) => att.player_id === player.id && att.is_present
                    )
                    return count + (isPresent ? 1 : 0)
                }, 0)

                const percentage = trainings.length > 0
                    ? Math.round((attendedCount / trainings.length) * 100)
                    : 0

                return { name: player.name, count: attendedCount, percentage }
            })

            // Sortieren nach Anwesenheit (häufigste zuerst)
            stats.sort((a, b) => b.count - a.count)

            stats.forEach(stat => {
                statsData.push([stat.name, stat.count, `${stat.percentage}%`])
            })

            // --- EXCEL ERSTELLEN ---
            const wb = new ExcelJS.Workbook()

            // Blatt 1 hinzufügen
            const wsAttendance = wb.addWorksheet('Übersicht')
            wsAttendance.addRows(attendanceData)

            // Spaltenbreiten Blatt 1
            wsAttendance.columns = [
                { width: 12 }, // Datum
                { width: 12 }, // Wochentag
                { width: 25 }, // Beschreibung
                { width: 20 }, // Trainer
                ...players.map(() => ({ width: 4 })) // Spieler schmal
            ]

            // Blatt 2 hinzufügen
            const wsStats = wb.addWorksheet('Statistik')
            wsStats.addRows(statsData)
            wsStats.columns = [
                { width: 20 }, // Name
                { width: 10 }, // Anwesend
                { width: 10 }  // Quote
            ]

            // --- DOWNLOAD ---
            const filename = `Anwesenheit_${startDate}_bis_${endDate}.xlsx`

            // Blob erstellen
            const wbout = await wb.xlsx.writeBuffer()
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

            // Download Logik für Mobile/Desktop
            const navigator = window.navigator as NavigatorWithMsSaveBlob
            if (typeof navigator.msSaveBlob !== 'undefined') {
                navigator.msSaveBlob(blob, filename)
            } else {
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', filename)
                document.body.appendChild(link)

                // WICHTIG: Kein Timeout vor dem Click, sonst blockieren Browser den Download
                link.click()

                // Aufräumen erst viel später (60s), damit der Download auf Mobile genug Zeit hat zu starten
                // Wenn man die URL zu früh revokt, bricht der Download ab oder schlägt fehl
                setTimeout(() => {
                    document.body.removeChild(link)
                    window.URL.revokeObjectURL(url)
                }, 60000)
            }
            console.log('ERFOLG: Download initiiert')
            toast.success('Excel-Export erfolgreich heruntergeladen!')
        } catch (error) {
            console.error('FEHLER:', error)
            toast.error('Fehler beim Export: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">Anwesenheit exportieren</h1>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                        >
                            Zurück
                        </button>
                    )}
                </div>
            </div>

            {/* Export Form */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6">
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Von Datum
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Bis Datum
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                    </div>
                </div>

                <button
                    onClick={exportToExcel}
                    disabled={loading || !startDate || !endDate}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                    {loading ? (
                        <>
                            <SpinnerIcon size={20} />
                            <span>Exportiere...</span>
                        </>
                    ) : (
                        <span>Als Excel herunterladen</span>
                    )}
                </button>
            </div>
        </div>
    )
}

