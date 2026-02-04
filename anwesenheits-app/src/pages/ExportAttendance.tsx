import { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

interface ExportAttendanceProps {
    onBack?: () => void
}

export default function ExportAttendance({ onBack }: ExportAttendanceProps) {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [loading, setLoading] = useState(false)

    async function exportToExcel() {
        if (!startDate || !endDate) {
            alert('Bitte Start- und Enddatum auswählen')
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

            const players = playersResponse.data || []
            const trainings = trainingsResponse.data || []

            if (trainings.length === 0) {
                alert('Keine Trainings im ausgewählten Zeitraum gefunden')
                setLoading(false)
                return
            }

            // --- BLATT 1: ANWESENHEITSLISTE ---
            const attendanceData: any[][] = []

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
                    ?.filter((ca: any) => ca.is_present && ca.coaches?.name)
                    .map((ca: any) => ca.coaches.name)
                    .join(', ') || '-'

                const row = [dateStr, weekday, description, coaches]

                // Checkmarks für jeden Spieler
                players.forEach(player => {
                    const isPresent = training.attendance?.some(
                        (att: any) => att.player_id === player.id && att.is_present
                    )
                    row.push(isPresent ? 'X' : '')
                })

                attendanceData.push(row)
            })

            // --- BLATT 2: STATISTIK ---
            const statsData: any[][] = []
            statsData.push(['TRAININGS-STATISTIK'])
            statsData.push([`Gesamtanzahl Trainings: ${trainings.length}`])
            statsData.push([''])
            statsData.push(['Name', 'Anwesend', 'Quote (%)'])

            // Statistik berechnen
            const stats = players.map(player => {
                const attendedCount = trainings.reduce((count, training) => {
                    const isPresent = training.attendance?.some(
                        (att: any) => att.player_id === player.id && att.is_present
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
            const wb = XLSX.utils.book_new()

            // Blatt 1 hinzufügen
            const wsAttendance = XLSX.utils.aoa_to_sheet(attendanceData)

            // Spaltenbreiten Blatt 1
            wsAttendance['!cols'] = [
                { wch: 12 }, // Datum
                { wch: 12 }, // Wochentag
                { wch: 25 }, // Beschreibung
                { wch: 20 }, // Trainer
                ...players.map(() => ({ wch: 4 })) // Spieler schmal
            ]
            XLSX.utils.book_append_sheet(wb, wsAttendance, 'Übersicht')

            // Blatt 2 hinzufügen
            const wsStats = XLSX.utils.aoa_to_sheet(statsData)
            wsStats['!cols'] = [
                { wch: 20 }, // Name
                { wch: 10 }, // Anwesend
                { wch: 10 }  // Quote
            ]
            XLSX.utils.book_append_sheet(wb, wsStats, 'Statistik')

            // --- DOWNLOAD ---
            const filename = `Anwesenheit_${startDate}_bis_${endDate}.xlsx`

            // Blob erstellen
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

            // Download Logik für Mobile/Desktop
            if (typeof (window.navigator as any).msSaveBlob !== 'undefined') {
                (window.navigator as any).msSaveBlob(blob, filename)
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

        } catch (error) {
            console.error('FEHLER:', error)
            alert('Fehler beim Export: ' + (error as Error).message)
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Exportiere...' : 'Als Excel herunterladen'}
                </button>
            </div>
        </div>
    )
}
