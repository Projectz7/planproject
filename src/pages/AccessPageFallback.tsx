import { Link } from "react-router-dom";
import { HardHat, ExternalLink } from "lucide-react";

export default function AccessPageFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto">
          <HardHat className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">PlanProject</h1>
        <p className="text-sm text-muted-foreground">
          Acesso exclusivo via <strong>P7Store</strong>. Entre na sua conta em P7Store e selecione PlanProject no catálogo de apps.
        </p>
        <a href="https://project-store-nu.vercel.app/" target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          Abrir P7Store <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p className="text-[11px] text-muted-foreground pt-2 border-t mt-4">
          Funcionário com token? Use o link recebido (<code className="text-xs bg-muted px-1 py-0.5 rounded">{'/access/<token>'}</code>).
        </p>
        <Link to="/access/placeholder" className="text-xs text-muted-foreground underline">debug: simular link</Link>
      </div>
    </div>
  );
}
