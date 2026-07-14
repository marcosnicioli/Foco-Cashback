"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createAuthorAction, updateAuthorAction } from "@/lib/actions/authors";
import { ACTION_ERROR_MESSAGES } from "@/lib/actions/errors";
import { authorFormSchema, type AuthorFormData } from "@/modules/authors/authors.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditableAuthor {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
  email: string | null;
}

export function AuthorFormDialog({
  author,
  trigger,
}: {
  author?: EditableAuthor;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = !!author;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthorFormData>({
    resolver: zodResolver(authorFormSchema),
    defaultValues: {
      name: author?.name ?? "",
      coupon: author?.coupon ?? "",
      cpfCnpj: author?.cpfCnpj ?? "",
      email: author?.email ?? "",
    },
  });

  async function onSubmit(data: AuthorFormData) {
    const result = isEdit
      ? await updateAuthorAction(author!.id, data)
      : await createAuthorAction(data);

    if (result.ok) {
      toast.success(isEdit ? "Autor atualizado." : "Autor cadastrado.");
      setOpen(false);
      if (!isEdit) reset({ name: "", coupon: "", cpfCnpj: "", email: "" });
      router.refresh();
    } else {
      const msg =
        result.error.code === "uniqueViolation"
          ? "Já existe um autor com esse cupom ou CPF/CNPJ."
          : ACTION_ERROR_MESSAGES[result.error.code];
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar autor" : "Novo autor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do autor."
              : "Cadastre um autor e seu cupom para gerar cashback."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon">Cupom</Label>
            <Input
              id="coupon"
              placeholder="LETICIA20"
              aria-invalid={!!errors.coupon}
              {...register("coupon")}
            />
            {errors.coupon && <p className="text-destructive text-xs">{errors.coupon.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpfCnpj">CPF/CNPJ (opcional)</Label>
            <Input id="cpfCnpj" aria-invalid={!!errors.cpfCnpj} {...register("cpfCnpj")} />
            {errors.cpfCnpj && <p className="text-destructive text-xs">{errors.cpfCnpj.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail (opcional)</Label>
            <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
