import { ShieldAlert } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccessDenied() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="bg-muted mb-2 flex h-10 w-10 items-center justify-center rounded-full">
          <ShieldAlert className="text-muted-foreground h-5 w-5" />
        </div>
        <CardTitle>Acesso negado</CardTitle>
        <CardDescription>
          Você não tem permissão para acessar esta área. Fale com um administrador.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
