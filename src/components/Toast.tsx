import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout((show as any)._t);
    (show as any)._t = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </Ctx.Provider>
  );
}
