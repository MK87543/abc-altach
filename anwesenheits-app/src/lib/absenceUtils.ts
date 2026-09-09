import type { CoachAbsence } from '../types/interfaces'

export const GERMAN_WEEKDAYS = [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
]

export const GERMAN_WEEKDAYS_SHORT = [
    'So',
    'Mo',
    'Di',
    'Mi',
    'Do',
    'Fr',
    'Sa',
]

export const GERMAN_MONTHS = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
]

/**
 * Gibt den Wochentag (0=Sonntag, 1=Montag, ..., 6=Samstag) für einen YYYY-MM-DD String zurück.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getDay()
}

/**
 * Ermittelt den Montag der Kalenderwoche für ein bestimmtes YYYY-MM-DD Datum (00:00:00 Uhr UTC).
 */
export function getMondayOfWeek(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const day = date.getUTCDay() // 0 = So, 1 = Mo, ..., 6 = Sa
    const diffToMonday = day === 0 ? -6 : 1 - day
    date.setUTCDate(date.getUTCDate() + diffToMonday)
    return date
}

/**
 * Berechnet den Abstand in vollen Kalenderwochen zwischen zwei Daten.
 */
export function getCalendarWeekDifference(startDateStr: string, targetDateStr: string): number {
    const startMonday = getMondayOfWeek(startDateStr)
    const targetMonday = getMondayOfWeek(targetDateStr)
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    return Math.round((targetMonday.getTime() - startMonday.getTime()) / msPerWeek)
}

/**
 * Formatiert wiederkehrende Tage und Intervall lesbar auf Deutsch:
 * z. B. "Jeden Dienstag", "Jeden Di, Do", "Alle 2 Wochen (Dienstag)", "Alle 2 Wochen (Di, Do)"
 */
export function formatRecurringSummary(
    recurringDays?: number[] | null,
    interval?: number | null,
    singleDayFallback?: number | null
): string {
    const days = (recurringDays && recurringDays.length > 0)
        ? recurringDays
        : (singleDayFallback !== null && singleDayFallback !== undefined ? [singleDayFallback] : [])

    const intrvl = interval || 1

    if (days.length === 0) {
        return intrvl > 1 ? `Alle ${intrvl} Wochen` : 'Wöchentlich'
    }

    // Sortierung nach Mo(1), Di(2), Mi(3), Do(4), Fr(5), Sa(6), So(0)
    const weekOrder = [1, 2, 3, 4, 5, 6, 0]
    const sortedDays = [...days].sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b))

    if (sortedDays.length === 1) {
        const dayName = GERMAN_WEEKDAYS[sortedDays[0]]
        return intrvl > 1 ? `Alle ${intrvl} Wochen (${dayName})` : `Jeden ${dayName}`
    }

    const shortNames = sortedDays.map(d => GERMAN_WEEKDAYS_SHORT[d]).join(', ')
    return intrvl > 1 ? `Alle ${intrvl} Wochen (${shortNames})` : `Jeden ${shortNames}`
}

/**
 * Prüft, ob eine Abwesenheit auf ein bestimmtes Datum zutrifft.
 */
export function isCoachAbsentOnDate(absence: CoachAbsence, dateStr: string): boolean {
    if (!absence || !dateStr) return false

    // 1. Einzeltag
    if (absence.absence_type === 'single') {
        return absence.start_date === dateStr
    }

    // 2. Datumsbereich (z. B. Urlaub über mehrere Tage/Wochen)
    if (absence.absence_type === 'range') {
        if (dateStr < absence.start_date) return false
        if (absence.end_date && dateStr > absence.end_date) return false
        return true
    }

    // 3. Wiederkehrend (z. B. jeden Dienstag oder alle 2 Wochen Di & Do)
    if (absence.absence_type === 'recurring') {
        // Gilt erst ab start_date
        if (dateStr < absence.start_date) return false
        // Wenn ein Enddatum definiert ist, gilt es nur bis dahin
        if (absence.end_date && dateStr > absence.end_date) return false

        const dayOfWeek = getDayOfWeekFromDateString(dateStr)

        const days: number[] = (absence.recurring_days && absence.recurring_days.length > 0)
            ? absence.recurring_days
            : (absence.recurring_day_of_week !== null && absence.recurring_day_of_week !== undefined ? [absence.recurring_day_of_week] : [])

        if (!days.includes(dayOfWeek)) {
            return false
        }

        // Intervall prüfen (z. B. alle 2 Wochen)
        const interval = absence.recurrence_interval || 1
        if (interval > 1) {
            const diffWeeks = getCalendarWeekDifference(absence.start_date, dateStr)
            if (diffWeeks < 0 || diffWeeks % interval !== 0) {
                return false
            }
        }

        return true
    }

    return false
}

/**
 * Filtert alle Abwesenheiten heraus, die an einem bestimmten Tag aktiv sind.
 */
export function getAbsencesForDate(absences: CoachAbsence[], dateStr: string): CoachAbsence[] {
    return absences.filter(a => isCoachAbsentOnDate(a, dateStr))
}

/**
 * Erstellt eine Map von coach_id -> CoachAbsence für schnelles Nachschlagen bei der Trainingsplanung.
 */
export function getCoachAbsenceMapForDate(absences: CoachAbsence[], dateStr: string): Map<string, CoachAbsence> {
    const map = new Map<string, CoachAbsence>()
    for (const a of absences) {
        if (isCoachAbsentOnDate(a, dateStr)) {
            // Falls schon eine vorhanden ist, bevorzugen wir konkretere Einträge (z.B. Einzeltag vor Wiederkehrend)
            if (!map.has(a.coach_id) || a.absence_type !== 'recurring') {
                map.set(a.coach_id, a)
            }
        }
    }
    return map
}

/**
 * Formatiert eine Abwesenheit in lesbarem Deutsch (z. B. "Jeden Dienstag (Beruflich)", "Alle 2 Wochen (Di, Do)").
 */
export function formatAbsenceGerman(absence: CoachAbsence): string {
    const reasonText = absence.reason ? ` (${cleanReasonText(absence.reason)})` : ''

    if (absence.absence_type === 'recurring') {
        const summary = formatRecurringSummary(
            absence.recurring_days,
            absence.recurrence_interval,
            absence.recurring_day_of_week
        )
        return `${summary}${reasonText}`
    }

    if (absence.absence_type === 'range') {
        const startFormatted = formatDateShortGerman(absence.start_date)
        const endFormatted = absence.end_date ? formatDateShortGerman(absence.end_date) : 'unbefristet'
        return `${startFormatted} – ${endFormatted}${reasonText}`
    }

    return `${formatDateShortGerman(absence.start_date)}${reasonText}`
}

/**
 * Formatiert ein YYYY-MM-DD Datum in DD.MM.YYYY
 */
export function formatDateGerman(dateStr: string): string {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}.${m}.${y}`
}

/**
 * Formatiert ein YYYY-MM-DD Datum kurz: DD.MM.
 */
export function formatDateShortGerman(dateStr: string): string {
    if (!dateStr) return ''
    const [, m, d] = dateStr.split('-')
    return `${d}.${m}.`
}

/**
 * Liefert das Label für die Art der Abwesenheit.
 */
export function getAbsenceTypeBadge(absence: CoachAbsence): { label: string; color: string } {
    if (absence.absence_type === 'recurring') {
        const label = formatRecurringSummary(
            absence.recurring_days,
            absence.recurrence_interval,
            absence.recurring_day_of_week
        )
        return { label, color: 'bg-purple-100 text-purple-800 border-purple-300' }
    }
    if (absence.absence_type === 'range') {
        return { label: 'Urlaub / Zeitraum', color: 'bg-amber-100 text-amber-800 border-amber-300' }
    }
    return { label: 'Einzeltag', color: 'bg-blue-100 text-blue-800 border-blue-300' }
}

/**
 * Bereinigt einen Grund-String, indem führende Emojis oder doppelte Leerzeichen entfernt werden.
 */
export function cleanReasonText(reason?: string | null): string {
    if (!reason) return ''
    return reason.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+/u, '').trim()
}

/**
 * Ermittelt das passende Icon (Emoji) für eine Abwesenheit.
 * Erkennt semantische Schlüsselwörter im Grund, benutzerdefinierte Emojis oder fällt sauber auf den Typ zurück.
 */
export function getAbsenceIcon(absence: { absence_type?: string; reason?: string | null }): string {
    const rawReason = (absence.reason || '').trim()
    const cleanText = cleanReasonText(rawReason).toLowerCase()

    // 1. Semantische Erkennung anhand von Schlüsselwörtern (hat Vorrang, damit alte Präfixe oder Textänderungen sofort greifen)
    if (cleanText) {
        if (
            cleanText.includes('urlaub') ||
            cleanText.includes('ferien') ||
            cleanText.includes('strand') ||
            cleanText.includes('holiday') ||
            cleanText.includes('reise') ||
            cleanText.includes('trip') ||
            cleanText.includes('sommer') ||
            cleanText.includes('flug') ||
            cleanText.includes('ausflug') ||
            cleanText.includes('berge') ||
            cleanText.includes('ski') ||
            cleanText.includes('wandern') ||
            cleanText.includes('pause')
        ) {
            return '🏖️'
        }

        if (
            cleanText.includes('beruf') ||
            cleanText.includes('arbeit') ||
            cleanText.includes('job') ||
            cleanText.includes('meeting') ||
            cleanText.includes('dienst') ||
            cleanText.includes('schicht') ||
            cleanText.includes('work') ||
            cleanText.includes('büro') ||
            cleanText.includes('geschäft') ||
            cleanText.includes('überstunden') ||
            cleanText.includes('firma')
        ) {
            return '💼'
        }

        if (
            cleanText.includes('schule') ||
            cleanText.includes('uni') ||
            cleanText.includes('studium') ||
            cleanText.includes('prüfung') ||
            cleanText.includes('klausur') ||
            cleanText.includes('lernen') ||
            cleanText.includes('fortbildung') ||
            cleanText.includes('kurs') ||
            cleanText.includes('ausbildung') ||
            cleanText.includes('lehrgang') ||
            cleanText.includes('seminar') ||
            cleanText.includes('matura') ||
            cleanText.includes('bachelor') ||
            cleanText.includes('master')
        ) {
            return '🎓'
        }

        if (
            cleanText.includes('krank') ||
            cleanText.includes('verletzt') ||
            cleanText.includes('arzt') ||
            cleanText.includes('zahnarzt') ||
            cleanText.includes('spital') ||
            cleanText.includes('reha') ||
            cleanText.includes('unfall') ||
            cleanText.includes('fieber') ||
            cleanText.includes('grippe') ||
            cleanText.includes('op') ||
            cleanText.includes('operation') ||
            cleanText.includes('schmerzen') ||
            cleanText.includes('bettruhe') ||
            cleanText.includes('gesundheit')
        ) {
            return '🩹'
        }

        if (
            cleanText.includes('privat') ||
            cleanText.includes('familie') ||
            cleanText.includes('geburtstag') ||
            cleanText.includes('hochzeit') ||
            cleanText.includes('feier') ||
            cleanText.includes('eltern') ||
            cleanText.includes('kind') ||
            cleanText.includes('kinder') ||
            cleanText.includes('umzug') ||
            cleanText.includes('haus') ||
            cleanText.includes('wohnung') ||
            cleanText.includes('taufe') ||
            cleanText.includes('jubiläum')
        ) {
            return '🏠'
        }

        if (
            cleanText.includes('turnier') ||
            cleanText.includes('wettkampf') ||
            cleanText.includes('meisterschaft') ||
            cleanText.includes('spiel') ||
            cleanText.includes('match') ||
            cleanText.includes('bewerb') ||
            cleanText.includes('cup')
        ) {
            return '🏆'
        }

        if (
            cleanText.includes('badminton') ||
            cleanText.includes('training') ||
            cleanText.includes('halle') ||
            cleanText.includes('sport')
        ) {
            return '🏸'
        }

        if (
            cleanText.includes('termin') ||
            cleanText.includes('amt') ||
            cleanText.includes('behörde') ||
            cleanText.includes('pass') ||
            cleanText.includes('notar') ||
            cleanText.includes('bank') ||
            cleanText.includes('auto')
        ) {
            return '🗓️'
        }
    }

    // 2. Falls kein Keyword zutrifft, aber ein explizites Emoji eingetippt wurde
    const emojiMatch = rawReason.match(/(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u)
    if (emojiMatch) {
        return emojiMatch[0]
    }

    // 3. Fallback nach Typ
    if (absence.absence_type === 'recurring') {
        return '🔄'
    }
    if (absence.absence_type === 'range') {
        return '🏖️'
    }
    return '🗓️'
}

/**
 * Gibt ein visuelles Farbschema für die Abwesenheit basierend auf dem Icon und Typ zurück.
 */
export function getAbsenceTheme(absence: { absence_type?: string; reason?: string | null }): {
    icon: string
    bgClass: string
    textClass: string
    borderClass: string
} {
    const icon = getAbsenceIcon(absence)

    switch (icon) {
        case '🏖️':
        case '✈️':
        case '🚗':
            return { icon, bgClass: 'bg-amber-100', textClass: 'text-amber-900', borderClass: 'border-amber-300' }
        case '💼':
            return { icon, bgClass: 'bg-blue-100', textClass: 'text-blue-900', borderClass: 'border-blue-300' }
        case '🎓':
            return { icon, bgClass: 'bg-indigo-100', textClass: 'text-indigo-900', borderClass: 'border-indigo-300' }
        case '🩹':
        case '🤒':
            return { icon, bgClass: 'bg-rose-100', textClass: 'text-rose-900', borderClass: 'border-rose-300' }
        case '🏠':
            return { icon, bgClass: 'bg-emerald-100', textClass: 'text-emerald-900', borderClass: 'border-emerald-300' }
        case '🏆':
        case '🎉':
            return { icon, bgClass: 'bg-yellow-100', textClass: 'text-yellow-900', borderClass: 'border-yellow-300' }
        case '🔄':
            return { icon, bgClass: 'bg-purple-100', textClass: 'text-purple-900', borderClass: 'border-purple-300' }
        case '🗓️':
        case '📅':
        default:
            return { icon, bgClass: 'bg-sky-100', textClass: 'text-sky-900', borderClass: 'border-sky-300' }
    }
}

