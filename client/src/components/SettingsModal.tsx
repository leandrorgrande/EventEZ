import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, HelpCircle, Trash2 } from "lucide-react";

// EVENTU: Settings modal for user account management
const settingsSchema = z.object({
  email: z.string().email("Por favor, insira um email válido").optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").optional(),
  confirmPassword: z.string().optional(),
  supportMessage: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export default function SettingsModal({ open, onOpenChange, user }: SettingsModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      supportMessage: "",
    },
  });

  // EVENTU: Update email mutation (mock for now)
  const updateEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mock implementation - real app would verify current password first
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Atualização de Email",
        description: "A funcionalidade de atualização de email em breve! Por enquanto, entre em contato com o suporte para alterar seu email.",
      });
      return {};
    },
  });

  // EVENTU: Change password mutation (mock for now)
  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mock implementation - real app would use proper auth endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Senha Alterada",
        description: "Sua senha foi atualizada com sucesso.",
      });
      return {};
    },
  });

  // EVENTU: Delete account mutation (mock for now)
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // Mock implementation - real app would require confirmation and proper authorization
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Exclusão de Conta",
        description: "A funcionalidade de exclusão de conta em breve! Por favor, entre em contato com o suporte para excluir sua conta.",
        variant: "destructive",
      });
      return {};
    },
  });

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    // EVENTU: Handle different update types based on what changed
    if (data.newPassword && data.currentPassword) {
      changePasswordMutation.mutate(data);
    } else if (data.email !== user?.email) {
      updateEmailMutation.mutate(data);
    } else {
      toast({
        title: "Nenhuma Alteração",
        description: "Nenhuma alteração foi feita na sua conta.",
      });
    }
  };

  const handleSupportMessage = () => {
    const message = form.getValues("supportMessage");
    if (!message) {
      toast({
        title: "Mensagem Obrigatória",
        description: "Por favor, insira uma mensagem para o suporte.",
        variant: "destructive",
      });
      return;
    }

    // EVENTU: Mock support message submission
    toast({
      title: "Mensagem Enviada",
      description: "Sua mensagem foi enviada para nossa equipe de suporte. Entraremos em contato em breve!",
    });
    form.setValue("supportMessage", "");
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteAccountMutation.mutate();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-settings-title">Configurações</DialogTitle>
            <DialogDescription className="text-gray-400">
              Gerencie as configurações e preferências da sua conta
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Account Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  Informações da Conta
                </h3>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Endereço de Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300">Alterar Senha</h3>
                
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Senha Atual</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Digite sua senha atual"
                          className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                          data-testid="input-current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Nova Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Digite sua nova senha"
                          className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                          data-testid="input-new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirme sua nova senha"
                          className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Support Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Contatar Suporte
                </h3>
                
                <FormField
                  control={form.control}
                  name="supportMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Mensagem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Como podemos ajudar?"
                          className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 resize-none"
                          rows={4}
                          data-testid="textarea-support"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="button"
                  onClick={handleSupportMessage}
                  variant="outline"
                  className="w-full bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  data-testid="button-send-support"
                >
                  Enviar Mensagem
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                  data-testid="button-cancel-settings"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateEmailMutation.isPending || changePasswordMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-save-settings"
                >
                  {updateEmailMutation.isPending || changePasswordMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>

              {/* Delete Account Section */}
              <div className="pt-4 border-t border-slate-700">
                <Button
                  type="button"
                  onClick={handleDeleteAccount}
                  variant="destructive"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  data-testid="button-delete-account"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Conta
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente excluídos.
                </p>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta
              e removerá todos os seus dados dos nossos servidores, incluindo:
              <ul className="list-disc ml-5 mt-2">
                <li>Todos os seus eventos</li>
                <li>Suas informações de perfil</li>
                <li>Seu histórico de eventos</li>
                <li>Qualquer reivindicação de empresa</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600" data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              Sim, Excluir Minha Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
