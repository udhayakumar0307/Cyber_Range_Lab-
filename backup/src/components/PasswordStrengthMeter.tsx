import React, { useMemo } from 'react';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
  username?: string;
}

export const evaluatePasswordPolicy = (password: string, email: string = '', username: string = '') => {
  const minLength = password.length >= 12;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);
  const number = /\d/.test(password);
  const special = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
  
  let notUserInfo = true;
  const lowerPw = password.toLowerCase();
  if (email) {
    const emailUser = email.split('@')[0].toLowerCase();
    if (email.toLowerCase() && lowerPw.includes(email.toLowerCase())) notUserInfo = false;
    if (emailUser.length >= 3 && lowerPw.includes(emailUser)) notUserInfo = false;
  }
  if (username && username.length >= 3 && lowerPw.includes(username.toLowerCase())) {
    notUserInfo = false;
  }

  const notRepeated = !/(.)\1{3,}/.test(password);

  const checks = {
    minLength,
    uppercase,
    lowercase,
    number,
    special,
    notUserInfo,
    notRepeated
  };

  const validCount = Object.values(checks).filter(Boolean).length;
  let strength: 'Weak' | 'Fair' | 'Strong' | 'Very Strong' = 'Weak';
  let percentage = 25;
  let color = 'bg-red-500';

  if (password.length >= 14 && validCount >= 7) {
    strength = 'Very Strong';
    percentage = 100;
    color = 'bg-emerald-500';
  } else if (password.length >= 12 && validCount >= 6) {
    strength = 'Strong';
    percentage = 75;
    color = 'bg-cyan-500';
  } else if (password.length >= 8 && validCount >= 4) {
    strength = 'Fair';
    percentage = 50;
    color = 'bg-amber-500';
  }

  const isValid = minLength && uppercase && lowercase && number && special && notUserInfo && notRepeated;

  return { checks, strength, percentage, color, isValid };
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password, email = '', username = '' }) => {
  const { checks, strength, percentage, color, isValid } = useMemo(() => {
    return evaluatePasswordPolicy(password, email, username);
  }, [password, email, username]);

  if (!password) return null;

  return (
    <div className="mt-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
      {/* Strength Bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            {isValid ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-amber-400" />}
            Password Strength:
          </span>
          <span className={`font-semibold ${
            strength === 'Very Strong' ? 'text-emerald-400' :
            strength === 'Strong' ? 'text-cyan-400' :
            strength === 'Fair' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {strength}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
        <CheckItem valid={checks.minLength} text="Minimum 12 characters" />
        <CheckItem valid={checks.uppercase} text="At least 1 uppercase letter" />
        <CheckItem valid={checks.lowercase} text="At least 1 lowercase letter" />
        <CheckItem valid={checks.number} text="At least 1 number" />
        <CheckItem valid={checks.special} text="At least 1 special character" />
        <CheckItem valid={checks.notUserInfo} text="Does not contain email / username" />
      </div>
    </div>
  );
};

const CheckItem: React.FC<{ valid: boolean; text: string }> = ({ valid, text }) => (
  <div className={`flex items-center gap-1.5 ${valid ? 'text-emerald-400' : 'text-slate-500'}`}>
    {valid ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
    <span>{text}</span>
  </div>
);
