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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const editProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  profileImage: z.any().optional(),
});

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export default function EditProfileModal({ open, onOpenChange, user }: EditProfileModalProps) {
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof editProfileSchema>>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      bio: user?.bio || "",
      profileImage: null,
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("profileImage", file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfileImage = async (file: File): Promise<string> => {
    // Mock image upload - in real app, upload to Firebase Storage or similar
    const mockUrl = `https://example.com/avatars/${Date.now()}_${file.name}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return mockUrl;
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      let profileImageUrl = user?.profileImageUrl;

      // Upload nova imagem se enviada
      if (data.profileImage) {
        profileImageUrl = await uploadProfileImage(data.profileImage);
      }

      // Atualizar perfil no Firestore (merge)
      const updateData = {
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phone: data.phone || "",
        bio: data.bio || "",
        profileImageUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.id), updateData, { merge: true });
      return updateData;
    },
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso!",
      });
      
      // Opcional: invalidar consultas se necessário (mantido para compatibilidade)
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Close modal
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editProfileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-profile-title">Editar Perfil</DialogTitle>
          <DialogDescription className="text-gray-400">
            Atualize suas informações pessoais e foto de perfil
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Profile Image */}
            <FormField
              control={form.control}
              name="profileImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Foto do Perfil</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage 
                          src={profileImagePreview || user?.profileImageUrl || ""} 
                          alt={user?.firstName || "User"} 
                        />
                        <AvatarFallback className="bg-blue-600 text-white text-lg">
                          {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0"
                          data-testid="input-profile-image"
                        />
                        {profileImagePreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileImagePreview(null);
                              form.setValue("profileImage", null);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 mt-1"
                            data-testid="button-remove-profile-image"
                          >
                            Remover nova imagem
                          </button>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome"
                        className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                        data-testid="input-first-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Sobrenome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Sobrenome"
                        className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                        data-testid="input-last-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-gray-300">Telefone</FormLabel>
                  <FormControl>
                    <Input
                        placeholder="Digite seu telefone"
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                      data-testid="input-phone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bio */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-gray-300">Biografia</FormLabel>
                  <FormControl>
                    <Textarea
                        placeholder="Conte um pouco sobre você..."
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 resize-none"
                      rows={3}
                      data-testid="textarea-bio"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700"
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}