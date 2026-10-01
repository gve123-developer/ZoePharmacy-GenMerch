import { useState, useEffect, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card } from '@/app/components/ui/card';
import { User } from '@/app/App';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, AlertCircle, Mail, KeyRound } from 'lucide-react';
import { logAuditAction } from '@/app/utils/auditUtils';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const defaultUsers: User[] = [
  {
    id: '1',
    username: 'owner',
    password: 'ZoeOwner@2025',
    role: 'admin',
    name: 'Zoe Owner'
  },
  {
    id: '2',
    username: 'admin',
    password: 'ZoeAdmin@2025',
    role: 'admin',
    name: 'Zoe Admin'
  }
];

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

const ParticleBackground = () => {
  const [dots, setDots] = useState<any[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 40,
        y: (e.clientY / window.innerHeight - 0.5) * 40,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const colors = ['#000000', '#2d3436', '#54b768', '#636e72'];
    const newDots = Array.from({ length: 450 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: -Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.4 + 0.2,
      parallaxFactor: Math.random() * 0.6 + 0.2,
    }));
    setDots(newDots);

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {dots.map(dot => (
        <div
          key={dot.id}
          className="absolute"
          style={{
            left: dot.left,
            top: dot.top,
            transform: `translate(${mousePos.x * dot.parallaxFactor}px, ${mousePos.y * dot.parallaxFactor}px)`,
            transition: 'transform 0.4s ease-out'
          }}
        >
          <div
            className="rounded-full animate-float"
            style={{
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              backgroundColor: dot.color,
              opacity: dot.opacity,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0); }
          25% { transform: translate(60px, 30px); }
          50% { transform: translate(30px, 80px); }
          75% { transform: translate(-40px, 40px); }
          100% { transform: translate(0, 0); }
        }
        .animate-float {
          animation: float linear infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const [shake, setShake] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Forgot password flow states
  const [forgotMode, setForgotMode] = useState<'login' | 'forgot' | 'verify'>('login');
  const [forgotInput, setForgotInput] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);

  // Initialize users in localStorage with real passwords on first load
  useEffect(() => {
    const storedUsers = localStorage.getItem('users');
    if (!storedUsers) {
      localStorage.setItem('users', JSON.stringify(defaultUsers));
    } else {
      // Migrate: ensure default users have the new secure passwords
      const users: User[] = JSON.parse(storedUsers);
      let changed = false;
      const updated = users.map(u => {
        if ((u.id === '1' || u.id === '2') && (!u.password || u.password === 'password')) {
          changed = true;
          const def = defaultUsers.find(d => d.id === u.id);
          return { ...u, password: def?.password ?? u.password };
        }
        return u;
      });
      if (changed) localStorage.setItem('users', JSON.stringify(updated));
    }

    // Restore lockout state across page refreshes
    const savedLockout = localStorage.getItem('loginLockoutUntil');
    const savedAttempts = localStorage.getItem('loginFailedAttempts');
    if (savedLockout) setLockoutUntil(parseInt(savedLockout));
    if (savedAttempts) setFailedAttempts(parseInt(savedAttempts));
  }, []);

  // Countdown timer during lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutCountdown(0);
        setFailedAttempts(0);
        setErrorMsg('');
        localStorage.removeItem('loginLockoutUntil');
        localStorage.removeItem('loginFailedAttempts');
        clearInterval(tick);
      } else {
        setLockoutCountdown(remaining);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [lockoutUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block if still locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      triggerShake();
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setErrorMsg(`Account locked. Try again in ${remaining}s.`);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        // ✅ Success — clear all lockout state
        setFailedAttempts(0);
        setLockoutUntil(null);
        localStorage.removeItem('loginLockoutUntil');
        localStorage.removeItem('loginFailedAttempts');

        toast.success(`Welcome back, ${result.user.name}!`);
        setIsOpening(true);

        // Save active user in localStorage
        localStorage.setItem('currentUser', JSON.stringify(result.user));

        // ✅ Audit: log successful login
        logAuditAction(result.user.name, 'Login', `User "${result.user.username}" logged in successfully.`);

        setTimeout(() => onLogin(result.user), 1000);
      } else {
        // ❌ Failed attempt
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        localStorage.setItem('loginFailedAttempts', newAttempts.toString());
        setIsLoading(false);
        triggerShake();

        // ✅ Audit: log failed login
        logAuditAction(username.trim() || 'Unknown', 'Login Failed', `Failed login attempt for username: "${username.trim()}". Attempt ${newAttempts} of ${MAX_ATTEMPTS}.`);

        if (newAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockoutUntil(until);
          setLockoutCountdown(LOCKOUT_SECONDS);
          localStorage.setItem('loginLockoutUntil', until.toString());
          setErrorMsg(`Too many failed attempts. Account locked for ${LOCKOUT_SECONDS} seconds.`);
          toast.error('Account temporarily locked due to too many failed attempts.');
        } else {
          const left = MAX_ATTEMPTS - newAttempts;
          setErrorMsg(`Incorrect username or password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`);
          toast.error('Invalid credentials. Please try again.');
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg('Failed to connect to database login service.');
      toast.error('Network or database connection error.');
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setErrorMsg('Please enter your username or email.');
      return;
    }
    setIsResetLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', login: forgotInput.trim() })
      });
      const result = await response.json();

      if (result.success) {
        setResetEmail(result.email);
        setForgotMode('verify');
        toast.success(result.message || 'Reset code sent to email!');
        setForgotInput('');
      } else {
        setErrorMsg(result.message || 'Failed to request reset code.');
        toast.error(result.message || 'Error occurred.');
      }
    } catch (err: any) {
      setErrorMsg('Server connection failed. Make sure PHP server is running.');
      toast.error('Network error.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword || !newPasswordConfirm) {
      setErrorMsg('All fields are required.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsResetLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          email: resetEmail,
          token: resetCode.trim(),
          password: newPassword
        })
      });
      const result = await response.json();

      if (result.success) {
        // Update user in localStorage
        const storedUsers = localStorage.getItem('users');
        const users: User[] = storedUsers ? JSON.parse(storedUsers) : defaultUsers;
        const updatedUsers = users.map(u => u.username === result.username ? { ...u, password: newPassword } : u);
        localStorage.setItem('users', JSON.stringify(updatedUsers));

        toast.success('Password updated successfully! You can now log in.');
        setForgotMode('login');
        setUsername(result.username || '');
        setPassword('');
        setResetCode('');
        setNewPassword('');
        setNewPasswordConfirm('');
      } else {
        setErrorMsg(result.message || 'Failed to reset password.');
        toast.error(result.message || 'Error occurred.');
      }
    } catch (err: any) {
      setErrorMsg('Server connection failed. Make sure PHP server is running.');
      toast.error('Network error.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-sans">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#54b768]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#54b768]/15 rounded-full blur-[100px] pointer-events-none" />

      <main className="flex-1 flex flex-col md:flex-row relative z-10 px-8 md:px-48 items-center justify-center gap-12 md:gap-64 py-12">
        <ParticleBackground />

        {/* Left: Branding */}
        <div className={`flex-none w-full md:w-auto md:max-w-2xl flex flex-col items-start space-y-8 transition-all duration-1000 ${isOpening ? 'opacity-0 -translate-x-12' : 'opacity-100 translate-x-0'}`}>
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-[0.85] tracking-tighter">
              ZOE <br />
              PHARMACY <br />
              <span className="text-[#54b768] text-2xl md:text-3xl block mt-2 tracking-tighter font-extrabold uppercase">
                & GENERAL MERCHANDISE
              </span>
            </h1>
            <div className="w-24 h-3 bg-[#54b768] rounded-full" />
          </div>

          <div className="space-y-4 w-full max-w-lg">
            <div className="bg-[#eef8f0] p-6 rounded-tr-[40px] rounded-br-[40px] border-l-[12px] border-[#54b768] shadow-md">
              <p className="text-gray-900 font-extrabold uppercase text-lg md:text-xl leading-tight tracking-tight">
                "MAG-INGAT SA MGA PEKENG GAMOT. BUMILI LAMANG SA MGA REGISTRADONG BOTIKA."
              </p>
            </div>
            <p className="text-gray-700 text-[10px] md:text-xs font-black tracking-[0.25em] uppercase italic ml-1">
              BRANDED AND QUALITY GENERIC MEDICINES AVAILABLE HERE
            </p>
          </div>
        </div>

        {/* Right: Login Capsule */}
        <div className="flex-none w-full max-w-[400px] flex justify-center items-center">
          <Card className={`w-full border-none transition-all duration-700 bg-transparent shadow-none p-0 flex flex-col gap-0 ${isOpening ? 'overflow-visible' : 'overflow-hidden shadow-2xl rounded-[200px]'}`}>

            {/* Top Half — White */}
            <div className={`bg-white pt-9 pb-4 px-9 flex flex-col items-center transition-all duration-1000 ease-in-out m-0 ${isOpening ? '-translate-y-[150%] rotate-[-10deg] opacity-0' : 'rounded-t-[200px]'}`}>
              <img
                src="/logo.jpg"
                alt="Zoe Pharmacy Logo"
                className="h-16 w-auto mb-2.5 drop-shadow-sm rounded-xl"
              />
            </div>

            <div className={`bg-[#54b768] px-10 pb-24 pt-6 flex flex-col space-y-3.5 transition-all duration-1000 ease-in-out m-0 ${isOpening ? 'translate-y-[150%] rotate-[10deg] opacity-0' : 'rounded-b-[200px]'}`}>
              {forgotMode === 'login' && (
                <form
                  ref={formRef}
                  onSubmit={handleSubmit}
                  className={`space-y-3.5 text-left ${shake ? 'shake' : ''}`}
                >
                  {/* Username */}
                  <div className="space-y-1">
                    <Label htmlFor="username" className="text-gray-900 font-black text-xs ml-1">USERNAME</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setErrorMsg(''); }}
                      required
                      disabled={isLocked || isLoading}
                      className="bg-white/95 border-none h-11.5 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <Label htmlFor="password" className="text-gray-900 font-black text-xs ml-1">PASSWORD</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                        required
                        disabled={isLocked || isLoading}
                        className="bg-white/95 border-none h-11.5 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right px-1">
                    <button
                      type="button"
                      onClick={() => { setForgotMode('forgot'); setErrorMsg(''); setForgotInput(''); }}
                      className="text-gray-900 hover:text-black font-extrabold text-xs transition-colors tracking-wider"
                    >
                      FORGOT PASSWORD?
                    </button>
                  </div>

                  {/* Error / Lockout banner */}
                  {errorMsg && (
                    <div className={`flex items-start gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold ${isLocked ? 'bg-red-600 text-white' : 'bg-black/10 text-gray-900'}`}>
                      {isLocked
                        ? <Lock className="size-3.5 mt-0.5 shrink-0" />
                        : <AlertCircle className="size-3.5 mt-0.5 shrink-0" />}
                      <span>
                        {isLocked
                          ? `Account locked — try again in ${lockoutCountdown}s`
                          : errorMsg}
                      </span>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={isLocked || isLoading}
                    className="w-full bg-gray-900 hover:bg-black text-white h-12 rounded-full font-black uppercase tracking-[.25em] text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        AUTHENTICATING...
                      </span>
                    ) : isLocked ? (
                      <span className="flex items-center gap-2">
                        <Lock className="size-4" />
                        LOCKED ({lockoutCountdown}s)
                      </span>
                    ) : (
                      'LOGIN'
                    )}
                  </Button>
                </form>
              )}

              {forgotMode === 'forgot' && (
                <form
                  onSubmit={handleForgotRequest}
                  className="space-y-3.5 text-left"
                >
                  <div className="space-y-1">
                    <Label htmlFor="forgotInput" className="text-gray-900 font-black text-xs ml-1">USERNAME OR EMAIL</Label>
                    <Input
                      id="forgotInput"
                      type="text"
                      placeholder="Enter username or email"
                      value={forgotInput}
                      onChange={(e) => { setForgotInput(e.target.value); setErrorMsg(''); }}
                      required
                      disabled={isResetLoading}
                      className="bg-white/95 border-none h-11.5 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60"
                    />
                  </div>

                  {errorMsg && (
                    <div className="flex items-start gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-black/10 text-gray-900">
                      <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isResetLoading}
                    className="w-full bg-gray-900 hover:bg-black text-white h-12 rounded-full font-black uppercase tracking-[.25em] text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isResetLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        SENDING CODE...
                      </span>
                    ) : (
                      'SEND RESET CODE'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setForgotMode('login'); setErrorMsg(''); }}
                    className="w-full border-none hover:bg-black/5 text-gray-900 h-10 rounded-full font-black uppercase tracking-[.2em] text-xs transition-all mt-1"
                  >
                    BACK TO LOGIN
                  </Button>
                </form>
              )}

              {forgotMode === 'verify' && (
                <form
                  onSubmit={handlePasswordReset}
                  className="space-y-2.5 text-left"
                >
                  <div className="space-y-0.5">
                    <Label className="text-gray-900 font-black text-xs ml-1">SENT TO</Label>
                    <p className="text-xs font-bold text-gray-800 ml-1 italic">{resetEmail}</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="resetCode" className="text-gray-900 font-black text-xs ml-1">6-DIGIT RESET CODE</Label>
                    <Input
                      id="resetCode"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={resetCode}
                      onChange={(e) => { setResetCode(e.target.value); setErrorMsg(''); }}
                      required
                      disabled={isResetLoading}
                      className="bg-white/95 border-none h-11 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60 text-center tracking-[0.4em] font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="newPassword" className="text-gray-900 font-black text-xs ml-1">NEW PASSWORD</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(''); }}
                      required
                      disabled={isResetLoading}
                      className="bg-white/95 border-none h-11 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="newPasswordConfirm" className="text-gray-900 font-black text-xs ml-1">CONFIRM NEW PASSWORD</Label>
                    <Input
                      id="newPasswordConfirm"
                      type="password"
                      placeholder="Confirm new password"
                      value={newPasswordConfirm}
                      onChange={(e) => { setNewPasswordConfirm(e.target.value); setErrorMsg(''); }}
                      required
                      disabled={isResetLoading}
                      className="bg-white/95 border-none h-11 rounded-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#54b768] transition-all px-4 text-sm disabled:opacity-60"
                    />
                  </div>

                  {errorMsg && (
                    <div className="flex items-start gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/10 text-gray-900">
                      <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isResetLoading}
                    className="w-full bg-gray-900 hover:bg-black text-white h-11.5 rounded-full font-black uppercase tracking-[.25em] text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 mt-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isResetLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        RESETTING PASSWORD...
                      </span>
                    ) : (
                      'RESET PASSWORD'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setForgotMode('forgot'); setErrorMsg(''); }}
                    className="w-full border-none hover:bg-black/5 text-gray-900 h-10 rounded-full font-black uppercase tracking-[.2em] text-xs transition-all mt-0.5"
                  >
                    CANCEL
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
