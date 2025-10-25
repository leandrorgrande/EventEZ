import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao EventEz",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Não foi possível fazer login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo/Título */}
        <div>
          <h1 className="text-6xl font-bold text-white mb-2">EventEz</h1>
          <p className="text-xl text-slate-300">
            Descubra eventos incríveis perto de você
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-1">🗺️ Mapa Interativo</h3>
            <p className="text-slate-400 text-sm">
              Veja eventos e lugares em tempo real
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-1">🔥 Horários Populares</h3>
            <p className="text-slate-400 text-sm">
              Saiba os melhores horários para sair
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-1">🎉 Crie Eventos</h3>
            <p className="text-slate-400 text-sm">
              Organize e promova seus próprios eventos
            </p>
          </div>
        </div>

        {/* Botão de Login */}
        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Entrar com Google
            </>
          )}
        </Button>

        <p className="text-slate-400 text-sm">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="text-blue-400 hover:underline">
            Termos de Serviço
          </a>{" "}
          e{" "}
          <a href="#" className="text-blue-400 hover:underline">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
