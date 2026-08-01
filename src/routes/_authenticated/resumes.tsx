import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";
import { fetchResumes, removeResume, upsertResume } from "@/lib/resumes.functions";
import { extractDocumentText, validateResumeFile } from "@/lib/resume-parse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/resumes")({
  head: () => ({
    meta: [
      { title: "Resumes — MatchScore" },
      { name: "description", content: "Upload, parse and version your resumes." },
      { property: "og:title", content: "Resumes — MatchScore" },
      { property: "og:description", content: "Upload, parse and version your resumes." },
    ],
  }),
  component: ResumesPage,
});

interface ParsedPreview {
  skills?: string[];
  total_years_experience?: number;
  headline?: string;
}

function ResumesPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [pastedText, setPastedText] = useState("");

  const resumes = useQuery({ queryKey: ["resumes"], queryFn: () => fetchResumes() });

  const save = useMutation({
    mutationFn: (input: {
      title: string;
      rawText: string;
      filePath?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
    }) => upsertResume({ data: input }),
    onSuccess: () => {
      toast.success("Resume saved and parsed.");
      setTitle("");
      setPastedText("");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => removeResume({ data: { id } }),
    onSuccess: () => {
      toast.success("Resume deleted.");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFile(file: File) {
    const invalid = validateResumeFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      const text = await extractDocumentText(file);
      if (text.trim().length < 120) {
        toast.error("We couldn't read enough text from that file. Try a text-based PDF or DOCX.");
        return;
      }

      let filePath: string | null = null;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("resumes").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) console.error("[resumes] upload failed", error.message);
        else filePath = path;
      }

      await save.mutateAsync({
        title: title || file.name.replace(/\.[^.]+$/, ""),
        rawText: text,
        filePath,
        fileType: file.type || null,
        fileSize: file.size,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const working = busy || save.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Resumes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF or DOCX and we'll extract the text and structure it automatically.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Add a resume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <Label htmlFor="resume-title">Label (optional)</Label>
            <Input
              id="resume-title"
              placeholder="e.g. Senior Backend — 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </div>

          <Tabs defaultValue="upload">
            <TabsList>
              <TabsTrigger value="upload">Upload file</TabsTrigger>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-accent/5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
              >
                {working ? (
                  <Loader2 className="size-6 animate-spin text-primary" />
                ) : (
                  <Upload className="size-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {working ? "Reading and parsing…" : "Drop a PDF or DOCX, or click to browse"}
                </span>
                <span className="text-xs text-muted-foreground">Max 10 MB · PDF, DOCX, TXT</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  disabled={working}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                rows={10}
                placeholder="Paste the full text of your resume…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <Button
                disabled={working || pastedText.trim().length < 120}
                onClick={() =>
                  save.mutate({ title: title || "Pasted resume", rawText: pastedText })
                }
              >
                {working ? <Loader2 className="size-4 animate-spin" /> : null}
                Save and parse
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your library
        </h2>
        {resumes.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (resumes.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No resumes yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(resumes.data ?? []).map((resume) => {
              const parsed = (resume.parsed ?? {}) as ParsedPreview;
              return (
                <Card key={resume.id} className="surface-panel lift-on-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium text-foreground">
                          <FileText className="size-4 shrink-0 text-primary" />
                          {resume.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {resume.candidate_name ? `${resume.candidate_name} · ` : ""}v
                          {resume.version} · {new Date(resume.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete resume">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the file and its parsed profile. Existing
                              reports stay in your history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => destroy.mutate(resume.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {parsed.skills?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {parsed.skills.slice(0, 8).map((skill) => (
                          <Badge key={skill} variant="secondary" className="font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {parsed.skills.length > 8 ? (
                          <Badge variant="outline">+{parsed.skills.length - 8}</Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
