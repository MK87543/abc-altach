import { useState, useEffect, useCallback } from 'react'
import { getCookie, setCookie, deleteCookie, ACTIVE_COACH_COOKIE_KEY } from '../lib/cookieUtils'

const COACH_EVENT_NAME = 'abc_active_coach_changed'

export function useActiveCoach() {
    const [activeCoachId, setActiveCoachIdState] = useState<string | null>(() => {
        return getCookie(ACTIVE_COACH_COOKIE_KEY)
    })

    useEffect(() => {
        // Initiale Synchronisation beim Mounten
        const currentCookieVal = getCookie(ACTIVE_COACH_COOKIE_KEY)
        if (currentCookieVal !== activeCoachId) {
            setActiveCoachIdState(currentCookieVal)
        }

        // Listener für synchronen Wechsel über Komponenten hinweg
        const handleCoachChange = (e: CustomEvent<string | null>) => {
            setActiveCoachIdState(e.detail)
        }

        window.addEventListener(COACH_EVENT_NAME as any, handleCoachChange)
        return () => {
            window.removeEventListener(COACH_EVENT_NAME as any, handleCoachChange)
        }
    }, [activeCoachId])

    const setActiveCoach = useCallback((coachId: string | null) => {
        if (coachId) {
            setCookie(ACTIVE_COACH_COOKIE_KEY, coachId, 365)
        } else {
            deleteCookie(ACTIVE_COACH_COOKIE_KEY)
        }
        setActiveCoachIdState(coachId)

        // Event auslösen, damit alle Tabs / Komponenten sofort aktualisiert werden
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(COACH_EVENT_NAME, { detail: coachId }))
        }
    }, [])

    return {
        activeCoachId,
        setActiveCoach,
        clearActiveCoach: () => setActiveCoach(null),
    }
}
