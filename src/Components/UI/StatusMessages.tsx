// Error Component
export const ErrorBanner = ({ message }: { message: string }) => (
    <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 flex items-start gap-3 animate-fade-in">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mt-0.5 text-red-400 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div className="text-sm">
            <span className="font-semibold">Error Occurred:</span> {message}
        </div>
    </div>
);

// Success Component
export const SuccessBanner = ({ message }: { message: string }) => (
    <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 flex items-start gap-3 animate-fade-in">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm font-semibold">{message}</div>
    </div>
);

// Loading Component
export const LoadingSpinner = ({ label = "Processing securely..." }: { label?: string }) => (
    <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-slate-400 text-sm">{label}</span>
    </div>
);