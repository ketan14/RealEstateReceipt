import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    checkPinSetup();
  }, []);

  const checkPinSetup = async () => {
    try {
      const isSetup: boolean = await invoke('is_pin_setup');
      setIsSetupMode(!isSetup);
    } catch (err) {
      console.error('Failed to check pin setup:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isSetupMode) {
      if (pin.length < 4) {
        setErrorMsg('PIN must be at least 4 characters');
        return;
      }
      if (pin !== confirmPin) {
        setErrorMsg('PINs do not match');
        return;
      }

      try {
        await invoke('setup_pin', { pin });
        onUnlock();
      } catch (err: any) {
        setErrorMsg(err.toString());
      }
    } else {
      try {
        const isValid: boolean = await invoke('verify_pin', { pin });
        if (isValid) {
          onUnlock();
        } else {
          setErrorMsg('Invalid PIN');
          setPin('');
        }
      } catch (err: any) {
        setErrorMsg(err.toString());
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-8 animate-scale-up">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-950 border border-indigo-500/30 mb-4 shadow-lg shadow-indigo-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-200">
            {isSetupMode ? 'Set Up Master PIN' : 'Enter Master PIN'}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {isSetupMode
              ? 'Create a secure PIN to protect your Real Estate ERP data.'
              : 'Please enter your PIN to access the application.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full text-center tracking-[0.5em] text-2xl bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:tracking-normal placeholder:text-sm"
                placeholder="Enter PIN"
                autoFocus
              />
            </div>

            {isSetupMode && (
              <div>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-2xl bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:tracking-normal placeholder:text-sm"
                  placeholder="Confirm PIN"
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="text-red-400 text-sm text-center font-medium flex items-center justify-center gap-1.5 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2.25m0 4.5h.008v.008H12v-.008zM2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12z" />
              </svg>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex justify-center items-center gap-2"
          >
            {isSetupMode ? 'Save & Unlock' : 'Unlock Application'}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
