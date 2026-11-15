"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", user.id);

      if (error) {
        toast.error(error.message || "Could not update your profile.");
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Could not update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full-name">Full name</Label>
        <Input
          id="full-name"
          name="full-name"
          autoComplete="name"
          placeholder="Your name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Used to personalise your workspace. Your email address is managed
          separately and cannot be changed here.
        </p>
      </div>

      <Button type="submit" size="sm" disabled={saving || name === initialName}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
