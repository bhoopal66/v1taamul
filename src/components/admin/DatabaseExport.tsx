import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Database, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchChunk(path: string, token: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/export-database?${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.text();
}

export function DatabaseExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const { toast } = useToast();
  const { userRole } = useAuth();

  if (userRole !== "super_admin") return null;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setStatusText("Authenticating…");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in first.");
      const token = session.access_token;

      // Step 1: fetch table list
      setStatusText("Fetching table list…");
      const listRes = await fetch(`${SUPABASE_URL}/functions/v1/export-database?action=tables`, {
        headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      });
      if (!listRes.ok) throw new Error("Failed to fetch table list");
      const { tables } = await listRes.json() as { tables: string[] };

      const parts: string[] = [];
      const totalSteps = tables.length + 2; // schema + auth + each table
      let step = 0;

      const advance = (label: string) => {
        step++;
        setProgress(Math.round((step / totalSteps) * 100));
        setStatusText(label);
      };

      // Step 2: schema
      advance("Exporting schema…");
      const schema = await fetchChunk("action=schema", token);
      parts.push(schema);

      // Step 3: auth users
      advance("Exporting auth users…");
      const auth = await fetchChunk("action=auth", token);
      parts.push(`\n-- ═══════════════════════════════════\n-- DATA\n-- ═══════════════════════════════════\n\n`);
      parts.push(auth);

      // Step 4: each table
      for (const table of tables) {
        advance(`Exporting table: ${table}…`);
        try {
          const data = await fetchChunk(`action=table&table=${table}`, token);
          parts.push(data);
        } catch (e: any) {
          parts.push(`-- Error exporting ${table}: ${e.message}\n\n`);
        }
      }

      setStatusText("Stitching file…");
      setProgress(99);

      // Combine and download
      const fullSql = parts.join("");
      const blob = new Blob([fullSql], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `database_export_${dateStr}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatusText("Export complete!");

      toast({
        title: "Export successful",
        description: `Full database exported to database_export_${dateStr}.sql`,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export database",
        variant: "destructive",
      });
      setStatusText("");
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setProgress(0);
        setStatusText("");
      }, 3000);
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-destructive" />
          <CardTitle>Database Export</CardTitle>
        </div>
        <CardDescription>
          Export the complete database (schema + all data) as a SQL file. Super Admin only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Database className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Full Database Backup</p>
              <p className="text-sm text-muted-foreground">
                Exports schema, enums, functions, RLS, auth users, and all table data as INSERT statements.
                Large databases may take 1–2 minutes.
              </p>
            </div>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{statusText}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting… ({progress}%)
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Full Database to SQL
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
