/**
 * Hilfsfunktionen zur Speicherung von Daten in Cookies
 * z. B. für den aktuell ausgewählten Trainer ("Aktiver Trainer")
 */

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const nameEQ = encodeURIComponent(name) + '='
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim()
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length))
        }
    }
    return null
}

export function setCookie(name: string, value: string, days = 365): void {
    if (typeof document === 'undefined') return
    let expires = ''
    if (days) {
        const date = new Date()
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
        expires = '; expires=' + date.toUTCString()
    }
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`
}

export function deleteCookie(name: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`
}

export const ACTIVE_COACH_COOKIE_KEY = 'abc_active_coach_id'
