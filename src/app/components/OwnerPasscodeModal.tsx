import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Delete, AlertCircle, Loader2, Mail, X } from 'lucide-react';
import { toast } from 'sonner';

interface OwnerPasscodeModalProps {
  isOpen: boolean;
  actionTitle: string;
  actionDescription?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const DIAL_KEYS = [
  { num: '1', letters: '' },
  { num: '2', letters: 'ABC' },
  { num: '3', letters: 'DEF' },
  { num: '4', letters: 'GHI' },
  { num: '5', letters: 'JKL' },
  { num: '6', letters: 'MNO' },
  { num: '7', letters: 'PQRS' },
  { num: '8', letters: 'TUV' },
  { num: '9', letters: 'WXYZ' },
];

export function OwnerPasscodeModal({
  isOpen,
  actionTitle,
  actionDescription,
  onSuccess,
  onClose
}: OwnerPasscodeModalProps) {
  const [passcode, setPasscode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setErrorMsg('');
      setShake(false);
    }
  }, [isOpen]);

  // Handle Passcode verification
  const verifyPasscode = useCallback(async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/owner_security.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', passcode: codeToVerify })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Owner authorization granted.');
        setPasscode('');
        onSuccess();
      } else {
        setShake(true);
        setErrorMsg(result.message || 'Incorrect passcode. Please try again.');
        setTimeout(() => {
          setPasscode('');
          setShake(false);
        }, 500);
      }
    } catch (err) {
      setErrorMsg('Network or server error verifying passcode.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, onSuccess]);

  // Append digit
  const handleDigitPress = useCallback((digit: string) => {
    if (isVerifying || passcode.length >= 6) return;
    const next = passcode + digit;
    setPasscode(next);
    setErrorMsg('');

    if (next.length === 6) {
      verifyPasscode(next);
    }
  }, [passcode, isVerifying, verifyPasscode]);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (isVerifying || passcode.length === 0) return;
    setPasscode(prev => prev.slice(0, -1));
    setErrorMsg('');
  }, [isVerifying, passcode.length]);

  // Handle physical keyboard input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitPress, handleBackspace, onClose]);

  // Owner-only forgot passcode reset
  const handleForgotPasscode = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/owner_security.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot_passcode' })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'A new 6-digit passcode was sent to the Owner email.');
        setPasscode('');
        setErrorMsg('');
      } else {
        setErrorMsg(result.message || 'Failed to generate reset passcode.');
        toast.error(result.message || 'Reset failed.');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to reset service.');
      toast.error('Connection error.');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200">
      <div
        className={`relative w-full max-w-sm rounded-3xl bg-white/85 backdrop-blur-xl border border-white/60 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center transition-all ${
          shake ? 'animate-shake' : ''
        }`}
        style={{
          boxShadow: '0 20px 50px -10px rgba(79, 70, 229, 0.15), 0 10px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100/60 transition-colors"
          title="Cancel"
        >
          <X className="size-5" />
        </button>

        {/* Shield Icon in Forecasting Analytics Indigo */}
        <div className="bg-indigo-100 p-3 rounded-2xl shadow-sm text-indigo-600 mb-3 border border-indigo-200/60">
          <ShieldCheck className="size-7" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-indigo-950 tracking-tight">
          Owner Authorization
        </h3>

        {/* Action Badge */}
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider">
          {actionTitle}
        </div>

        {actionDescription && (
          <p className="text-xs text-gray-500 mt-1.5 max-w-[280px]">
            {actionDescription}
          </p>
        )}

        {/* 6-Digit PIN Indicator Dots */}
        <div className="flex items-center justify-center gap-3.5 my-6">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = passcode.length > index;
            return (
              <div
                key={index}
                className={`size-4 rounded-full transition-all duration-150 ${
                  errorMsg
                    ? 'border-2 border-red-500 bg-red-500 shadow-sm shadow-red-300 scale-105'
                    : isFilled
                    ? 'border-2 border-indigo-600 bg-indigo-600 shadow-md shadow-indigo-300 scale-110'
                    : 'border-2 border-indigo-200 bg-white/80'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mb-3 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Circular Keypad Grid (3x4) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 my-2">
          {DIAL_KEYS.map(({ num, letters }) => (
            <button
              key={num}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigitPress(num)}
              className="size-16 sm:size-17 rounded-full border border-gray-200/80 bg-white/90 hover:bg-indigo-50 hover:border-indigo-300 active:scale-95 active:bg-indigo-100 transition-all flex flex-col items-center justify-center text-gray-800 shadow-sm select-none cursor-pointer focus:outline-none group"
            >
              <span className="text-2xl font-bold leading-none text-gray-800 group-hover:text-indigo-950">{num}</span>
              {letters && (
                <span className="text-[9px] text-gray-400 group-hover:text-indigo-600 font-bold uppercase tracking-widest mt-0.5">
                  {letters}
                </span>
              )}
            </button>
          ))}

          {/* Row 4: Cancel, 0, Backspace */}
          <button
            type="button"
            disabled={isVerifying}
            onClick={onClose}
            className="size-16 sm:size-17 rounded-full text-xs font-bold uppercase text-gray-500 hover:text-gray-800 hover:bg-gray-100/70 active:scale-95 transition-all flex items-center justify-center cursor-pointer select-none focus:outline-none"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigitPress('0')}
            className="size-16 sm:size-17 rounded-full border border-gray-200/80 bg-white/90 hover:bg-indigo-50 hover:border-indigo-300 active:scale-95 active:bg-indigo-100 transition-all flex flex-col items-center justify-center text-gray-800 shadow-sm select-none cursor-pointer focus:outline-none group"
          >
            <span className="text-2xl font-bold leading-none text-gray-800 group-hover:text-indigo-950">0</span>
          </button>

          <button
            type="button"
            disabled={isVerifying || passcode.length === 0}
            onClick={handleBackspace}
            className="size-16 sm:size-17 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100/70 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer select-none focus:outline-none"
            title="Delete"
          >
            <Delete className="size-6" />
          </button>
        </div>

        {/* Reset Passcode via Email - Owner Only */}
        <div className="mt-5 pt-4 border-t border-gray-200/80 w-full flex flex-col items-center">
          <button
            type="button"
            disabled={isResetting}
            onClick={handleForgotPasscode}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isResetting ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-indigo-600" />
                <span>Generating and emailing new passcode...</span>
              </>
            ) : (
              <>
                <Mail className="size-3.5" />
                <span>Forgot Passcode? Send new code to Owner Email</span>
              </>
            )}
          </button>
          <span className="text-[10px] text-gray-400 mt-1">
            Exclusive to Owner Account only
          </span>
        </div>
      </div>
    </div>
  );
}
