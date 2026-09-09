import { useState, useEffect, useCallback } from 'react'

/**
 * Get parameter value from current window.location.search
 */
export function getUrlParam(key: string, defaultValue = ''): string {
    if (typeof window === 'undefined') return defaultValue
    const params = new URLSearchParams(window.location.search)
    return params.get(key) ?? defaultValue
}

/**
 * Update multiple URL search parameters while preserving existing ones.
 * Updates history with pushState (default) or replaceState.
 */
export function updateUrlParams(
    paramsToUpdate: Record<string, string | null | undefined>,
    replace = false
) {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)

    for (const [key, value] of Object.entries(paramsToUpdate)) {
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key)
        } else {
            url.searchParams.set(key, value)
        }
    }

    if (replace) {
        window.history.replaceState({}, '', url.toString())
    } else {
        window.history.pushState({}, '', url.toString())
    }

    // Dispatch popstate event so other components listening can react
    window.dispatchEvent(new Event('popstate'))
}

/**
 * Custom React hook that binds a state to a URL Query Parameter.
 * Survives page refreshes and supports browser back/forward navigation.
 */
export function useUrlQueryParam<T extends string>(
    key: string,
    defaultValue: T,
    replace = false
): [T, (newValue: T) => void] {
    const [value, setValue] = useState<T>(() => {
        const param = getUrlParam(key)
        return (param as T) || defaultValue
    })

    // Listen to popstate (back/forward or programmatically triggered)
    useEffect(() => {
        const handlePopState = () => {
            const currentParam = getUrlParam(key)
            setValue((currentParam as T) || defaultValue)
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [key, defaultValue])

    const setParamValue = useCallback(
        (newValue: T) => {
            setValue(newValue)
            updateUrlParams({ [key]: newValue === defaultValue ? null : newValue }, replace)
        },
        [key, defaultValue, replace]
    )

    return [value, setParamValue]
}
