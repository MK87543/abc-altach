import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { WarningIcon, HelpCircleIcon, XIcon, EditIcon } from './Icons'

export interface ConfirmOptions {
    title?: string
    message: string | ReactNode
    confirmText?: string
    cancelText?: string
    isDanger?: boolean
}

export interface PromptOptions {
    title: string
    message?: string | ReactNode
    defaultValue?: string
    placeholder?: string
    confirmText?: string
    cancelText?: string
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>
    prompt: (options: PromptOptions | string) => Promise<string | null>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
    // Confirm state
    const [confirmState, setConfirmState] = useState<{
        options: ConfirmOptions
        resolve: (val: boolean) => void
    } | null>(null)

    // Prompt state
    const [promptState, setPromptState] = useState<{
        options: PromptOptions
        resolve: (val: string | null) => void
        value: string
    } | null>(null)

    const confirmButtonRef = useRef<HTMLButtonElement>(null)
    const promptInputRef = useRef<HTMLInputElement>(null)

    const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
        const normalized: ConfirmOptions = typeof options === 'string'
            ? { title: 'Bestätigen', message: options }
            : options

        return new Promise<boolean>((resolve) => {
            setConfirmState({
                options: normalized,
                resolve,
            })
        })
    }, [])

    const prompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
        const normalized: PromptOptions = typeof options === 'string'
            ? { title: 'Eingabe', message: options }
            : options

        return new Promise<string | null>((resolve) => {
            setPromptState({
                options: normalized,
                resolve,
                value: normalized.defaultValue || '',
            })
        })
    }, [])

    // Handle Confirm action
    const handleConfirmClose = (value: boolean) => {
        if (confirmState) {
            confirmState.resolve(value)
            setConfirmState(null)
        }
    }

    // Handle Prompt action
    const handlePromptClose = (submit: boolean) => {
        if (promptState) {
            promptState.resolve(submit ? promptState.value : null)
            setPromptState(null)
        }
    }

    // Auto focus and keyboard handling for Confirm
    useEffect(() => {
        if (confirmState) {
            confirmButtonRef.current?.focus()

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    handleConfirmClose(false)
                }
            }
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [confirmState])

    // Auto focus and keyboard handling for Prompt
    useEffect(() => {
        if (promptState) {
            setTimeout(() => {
                promptInputRef.current?.focus()
                promptInputRef.current?.select()
            }, 50)

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    handlePromptClose(false)
                } else if (e.key === 'Enter') {
                    e.preventDefault()
                    handlePromptClose(true)
                }
            }
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [promptState])

    return (
        <ConfirmContext.Provider value={{ confirm, prompt }}>
            {children}

            {/* Confirm Dialog Modal */}
            {confirmState && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-modal-title"
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 flex flex-col gap-4 transform transition-all scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4">
                            <div
                                className={`p-3 rounded-xl shrink-0 ${
                                    confirmState.options.isDanger
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-blue-100 text-blue-600'
                                }`}
                            >
                                {confirmState.options.isDanger ? (
                                    <WarningIcon size={24} />
                                ) : (
                                    <HelpCircleIcon size={24} />
                                )}
                            </div>

                            <div className="flex-1">
                                <h3 id="confirm-modal-title" className="text-lg font-bold text-gray-900 leading-tight">
                                    {confirmState.options.title || 'Bestätigung'}
                                </h3>
                                <div className="mt-2 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                    {confirmState.options.message}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleConfirmClose(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition"
                                aria-label="Schließen"
                            >
                                <XIcon size={18} />
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => handleConfirmClose(false)}
                                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
                            >
                                {confirmState.options.cancelText || 'Abbrechen'}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={() => handleConfirmClose(true)}
                                className={`px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition cursor-pointer ${
                                    confirmState.options.isDanger
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                }`}
                            >
                                {confirmState.options.confirmText || (confirmState.options.isDanger ? 'Löschen' : 'Bestätigen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Dialog Modal */}
            {promptState && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="prompt-modal-title"
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 flex flex-col gap-4 transform transition-all scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-blue-100 text-blue-600 shrink-0">
                                <EditIcon size={24} />
                            </div>

                            <div className="flex-1">
                                <h3 id="prompt-modal-title" className="text-lg font-bold text-gray-900 leading-tight">
                                    {promptState.options.title}
                                </h3>
                                {promptState.options.message && (
                                    <div className="mt-1 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                        {promptState.options.message}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => handlePromptClose(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition"
                                aria-label="Schließen"
                            >
                                <XIcon size={18} />
                            </button>
                        </div>

                        <div>
                            <input
                                ref={promptInputRef}
                                type="text"
                                value={promptState.value}
                                onChange={(e) => setPromptState(prev => prev ? { ...prev, value: e.target.value } : null)}
                                placeholder={promptState.options.placeholder || ''}
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white text-gray-900"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => handlePromptClose(false)}
                                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
                            >
                                {promptState.options.cancelText || 'Abbrechen'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePromptClose(true)}
                                className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition cursor-pointer"
                            >
                                {promptState.options.confirmText || 'Übernehmen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    )
}

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider')
    }
    return context
}
