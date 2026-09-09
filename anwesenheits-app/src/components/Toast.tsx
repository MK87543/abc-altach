import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckIcon, XIcon, WarningIcon } from './Icons'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
    id: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void
    toast: {
        success: (message: string, duration?: number) => void
        error: (message: string, duration?: number) => void
        warning: (message: string, duration?: number) => void
        info: (message: string, duration?: number) => void
    }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
        const id = 'toast-' + Math.random().toString(36).substring(2, 9)
        setToasts(prev => [...prev, { id, message, type, duration }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }, [removeToast])

    const toast = {
        success: (msg: string, dur?: number) => showToast(msg, 'success', dur),
        error: (msg: string, dur?: number) => showToast(msg, 'error', dur),
        warning: (msg: string, dur?: number) => showToast(msg, 'warning', dur),
        info: (msg: string, dur?: number) => showToast(msg, 'info', dur),
    }

    return (
        <ToastContext.Provider value={{ showToast, toast }}>
            {children}
            {/* Toast Container (Fixed Bottom-Right on Desktop, Bottom-Center on Mobile) */}
            <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
                {toasts.map(t => {
                    const isSuccess = t.type === 'success'
                    const isError = t.type === 'error'
                    const isWarning = t.type === 'warning'

                    const borderBg = isSuccess
                        ? 'bg-green-50 border-green-400 text-green-900 shadow-green-100'
                        : isError
                            ? 'bg-red-50 border-red-400 text-red-900 shadow-red-100'
                            : isWarning
                                ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-amber-100'
                                : 'bg-blue-50 border-blue-400 text-blue-900 shadow-blue-100'

                    const iconEl = isSuccess ? (
                        <span className="p-1 rounded-full bg-green-200 text-green-800 shrink-0">
                            <CheckIcon size={14} />
                        </span>
                    ) : isError ? (
                        <span className="p-1 rounded-full bg-red-200 text-red-800 shrink-0">
                            <XIcon size={14} />
                        </span>
                    ) : isWarning ? (
                        <span className="p-1 rounded-full bg-amber-200 text-amber-800 shrink-0">
                            <WarningIcon size={14} />
                        </span>
                    ) : (
                        <span className="p-1 rounded-full bg-blue-200 text-blue-800 shrink-0">
                            <CheckIcon size={14} />
                        </span>
                    )

                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all transform translate-y-0 opacity-100 ${borderBg}`}
                        >
                            {iconEl}
                            <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug break-words">
                                {t.message}
                            </p>
                            <button
                                type="button"
                                onClick={() => removeToast(t.id)}
                                className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition shrink-0"
                            >
                                <XIcon size={14} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
