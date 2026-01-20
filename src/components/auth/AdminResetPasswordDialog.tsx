import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Key } from 'lucide-react';

interface AdminResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    full_name?: string | null;
    username?: string;
  } | null;
}

export const AdminResetPasswordDialog: React.FC<AdminResetPasswordDialogProps> = ({
  open,
  onOpenChange,
  user,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('reset-password', {
        body: {
          email: user.email,
          newPassword: newPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`Password reset successfully for ${user.email}`);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setShowPassword(false);
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Reset User Password
          </DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user.full_name || user.username || user.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">User Email</Label>
            <Input
              id="user-email"
              type="email"
              value={user.email}
              disabled
              className="h-11 bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-new-password">New Password</Label>
            <div className="relative">
              <Input
                id="admin-new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || newPassword.length < 6}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Resetting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Reset Password
                </div>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
