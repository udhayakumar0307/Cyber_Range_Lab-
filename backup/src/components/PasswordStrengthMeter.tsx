import React, { useMemo } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
  username?: string;
}

// email/username are accepted for call-site compatibility (registration
// pages pass them) but no longer factor into validity — the policy is just
// length + case, matched by the backend's password_policy.py.
export const evaluatePasswordPolicy = (password: string, _email: string = '', _username: string = '') => {
  const minLength = password.length >= 8;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);

  const isValid = minLength && uppercase && lowercase;

  return {
    checks: { minLength, uppercase, lowercase },
    strength: isValid ? 'Good' as const : 'Weak' as const,
    isValid
  };
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const { strength, isValid } = useMemo(() => evaluatePasswordPolicy(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
      <div className="flex items-center gap-1.5">
        {isValid ? (
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-red-400" />
        )}
        <span className="text-slate-400 font-medium">Password Strength:</span>
        <span className={`font-semibold ${isValid ? 'text-emerald-400' : 'text-red-400'}`}>
          {strength}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full w-full transition-all duration-300 ${isValid ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>
      <p className="text-slate-500">At least 8 characters, with an uppercase and a lowercase letter.</p>
    </div>
  );
};
