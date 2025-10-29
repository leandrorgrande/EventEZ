import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle } from "lucide-react";

// EVENTU: Modal apenas para contato de suporte
const settingsSchema = z.object({
  supportMessage: z
    .string()
    .min(3, "Por favor, descreva seu problema ou dúvida")
    .optional(),
});

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export default function SettingsModal({ open, onOpenChange, user }: SettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      supportMessage: "",
    },
  });
  const onSubmit = () => {
    // Não há mais salvamento de configurações aqui
    onOpenChange(false);
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
            <DialogTitle data-testid="text-settings-title">Contate o Suporte</DialogTitle>
            <DialogDescription className="text-gray-400">
              Envie uma mensagem para nossa equipe de suporte
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Seção de Suporte */}
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
              <div className="flex pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="w-full bg-gray-600 hover:bg-gray-700"
                  data-testid="button-cancel-settings"
                >
                  Fechar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
