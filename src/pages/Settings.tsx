import { useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const { llm, setLLM } = useStore();
  const [form, setForm] = useState(llm);
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      if (form.mode === "Local Ollama") {
        const res = await fetch(`${form.ollama_endpoint}/api/tags`);
        if (res.ok) toast({ title: "Connected", description: "Ollama responded." });
        else throw new Error(`HTTP ${res.status}`);
      } else if (form.mode === "Off") {
        toast({ title: "LLM is Off", description: "MVP uses keyword matching only." });
      } else {
        toast({ title: "Cloud API", description: "Cloud API support is a placeholder for now." });
      }
    } catch (e) {
      toast({ title: "Connection failed", description: String((e as Error).message) });
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setLLM(form);
    toast({ title: "Settings saved" });
  }

  return (
    <Layout>
      <PageHeader title="Settings" description="Local LLM placeholder. MVP runs on keyword matching." />

      <Card className="max-w-2xl">
        <CardContent className="p-5 space-y-4">
          <div>
            <Label>LLM Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => setForm({ ...form, mode: v as typeof form.mode })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Off">Off (keyword matching only)</SelectItem>
                <SelectItem value="Local Ollama">Local Ollama</SelectItem>
                <SelectItem value="Cloud API">Cloud API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ollama Endpoint</Label>
            <Input value={form.ollama_endpoint} onChange={(e) => setForm({ ...form, ollama_endpoint: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Model Name</Label>
              <Input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
            </div>
            <div>
              <Label>Temperature</Label>
              <Input
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={test} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
            <p className="font-medium mb-1">Future LLM output shape</p>
            <pre className="bg-muted p-2 rounded text-[10px] overflow-auto">
{`{
  "evidence_summary": "...",
  "detected_keywords": ["mfa", "authentication"],
  "suggested_controls": [
    { "control_code": "AC-03", "confidence": 0.91, "rationale": "..." }
  ],
  "soc2_support": ["CC6.1", "CC6.6"],
  "missing_evidence": ["..."],
  "recommendation": "..."
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
